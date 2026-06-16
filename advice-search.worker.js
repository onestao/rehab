/* global FlexSearch */
importScripts('./lib/flexsearch.light.js');

// ---------------------------------------------------------
// AI Advice Chat Search Worker
// Implements Two-Stage Indexing and Progressive Snapshots
// ---------------------------------------------------------

const DB_NAME = 'rehab_pro_storage';
const AI_MESSAGES_STORE_NAME = 'ai_messages';
const DB_VERSION = 4;

// Stage 1: Fast in-memory cache of id -> text
let stage1Cache = new Map();

// Stage 2: Deep full-text index
let index = null;
let isIndexingComplete = false;

// Versioning for Snapshot Immutability
let searchVersion = 0;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      await handleInit(payload);
      break;
    case 'SEARCH':
      handleSearch(payload);
      break;
    case 'ADD':
      handleAdd(payload);
      break;
  }
};

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
    });
}

async function handleInit(payload) {
  if (index) return; // Already initialized

  // Initialize FlexSearch engine
  // @ts-ignore
  index = new FlexSearch.Index({
    tokenize: "forward",
    resolution: 9,
    minlength: 2
  });

  self.postMessage({ type: 'STATUS', payload: { state: 'STAGE1_START' } });

  try {
      const db = await openDB();
      const tx = db.transaction(AI_MESSAGES_STORE_NAME, 'readonly');
      const store = tx.objectStore(AI_MESSAGES_STORE_NAME);
      
      const req = store.getAll();
      req.onsuccess = () => {
          const records = req.result || [];
          
          // Stage 1: Fast memory cache setup
          records.forEach(r => {
              if (r.content && !r.deleted) {
                  stage1Cache.set(r.id, r.content);
              }
          });
          self.postMessage({ type: 'STATUS', payload: { state: 'STAGE1_DONE' } });

          // Stage 2: Incremental background index build
          // We process in batches to avoid blocking the worker event loop
          let idx = 0;
          const batchSize = 100;
          
          function processBatch() {
              const end = Math.min(idx + batchSize, records.length);
              for (; idx < end; idx++) {
                  const r = records[idx];
                  if (r.content && !r.deleted) {
                      index.add(r.id, r.content);
                  }
              }
              if (idx < records.length) {
                  setTimeout(processBatch, 10);
              } else {
                  isIndexingComplete = true;
                  searchVersion++;
                  self.postMessage({ type: 'STATUS', payload: { state: 'STAGE2_DONE' } });
              }
          }
          
          processBatch();
      };
      
      req.onerror = () => {
          console.error('[Search Worker] IDB read failed', req.error);
      };
  } catch (err) {
      console.error('[Search Worker] IDB open failed', err);
  }
}

function handleSearch(payload) {
  const query = payload.query;
  const limit = payload.limit || 100;
  let results = [];

  if (isIndexingComplete) {
      results = index.search(query, limit);
  } else {
      // Fallback: simple string match if index not ready
      for (let [id, text] of stage1Cache.entries()) {
          if (text.includes(query)) {
              results.push(id);
              if (results.length >= limit) break;
          }
      }
  }

  self.postMessage({ 
    type: 'SEARCH_RESULT', 
    payload: { query, results, version: searchVersion } 
  });
}

function handleAdd(payload) {
  const { id, text } = payload;
  stage1Cache.set(id, text);
  if (index) {
    index.add(id, text);
    searchVersion++;
  }
}
