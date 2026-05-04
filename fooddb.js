const fooddb = {
    items: [
        { id: 'rice', name: '米饭', cat: '主食', cal: 116, pro: 2.6, carb: 25.9, fat: 0.3, unit: '碗(150g)' },
        { id: 'noodle', name: '面条', cat: '主食', cal: 110, pro: 3.8, carb: 22.0, fat: 0.5, unit: '碗(200g)' },
        { id: 'mantou', name: '馒头', cat: '主食', cal: 223, pro: 7.0, carb: 47.0, fat: 1.1, unit: '个(100g)' },
        { id: 'congee', name: '白粥', cat: '主食', cal: 46, pro: 1.1, carb: 10.2, fat: 0.1, unit: '碗(250g)' },
        { id: 'bread_whole', name: '全麦面包', cat: '主食', cal: 246, pro: 12.0, carb: 41.0, fat: 3.5, unit: '片(35g)' },
        { id: 'oatmeal', name: '燕麦片', cat: '主食', cal: 367, pro: 15.0, carb: 61.0, fat: 6.7, unit: '30g' },
        { id: 'sweet_potato', name: '红薯', cat: '主食', cal: 86, pro: 1.6, carb: 20.1, fat: 0.1, unit: '个(200g)' },
        { id: 'corn', name: '玉米', cat: '主食', cal: 112, pro: 4.0, carb: 22.8, fat: 1.2, unit: '根(200g)' },
        { id: 'egg', name: '鸡蛋', cat: '蛋奶', cal: 144, pro: 13.3, carb: 1.5, fat: 9.5, unit: '个(50g)' },
        { id: 'milk', name: '纯牛奶', cat: '蛋奶', cal: 54, pro: 3.0, carb: 3.4, fat: 3.2, unit: '盒(250ml)' },
        { id: 'yogurt', name: '酸奶(原味)', cat: '蛋奶', cal: 72, pro: 3.4, carb: 9.3, fat: 2.7, unit: '杯(150g)' },
        { id: 'chicken_breast', name: '鸡胸肉', cat: '肉类', cal: 133, pro: 31.0, carb: 0, fat: 1.2, unit: '100g' },
        { id: 'pork_lean', name: '猪瘦肉', cat: '肉类', cal: 143, pro: 20.3, carb: 0, fat: 6.2, unit: '100g' },
        { id: 'beef', name: '牛肉', cat: '肉类', cal: 125, pro: 20.2, carb: 0, fat: 4.2, unit: '100g' },
        { id: 'fish_bass', name: '鲈鱼', cat: '肉类', cal: 105, pro: 18.6, carb: 0, fat: 3.4, unit: '100g' },
        { id: 'shrimp', name: '虾仁', cat: '肉类', cal: 87, pro: 18.6, carb: 0, fat: 0.7, unit: '100g' },
        { id: 'tofu', name: '豆腐', cat: '豆类', cal: 73, pro: 8.1, carb: 2.8, fat: 3.7, unit: '块(150g)' },
        { id: 'soy_milk', name: '豆浆(无糖)', cat: '豆类', cal: 31, pro: 2.9, carb: 1.2, fat: 1.6, unit: '杯(300ml)' },
        { id: 'broccoli', name: '西兰花', cat: '蔬菜', cal: 34, pro: 4.1, carb: 4.3, fat: 0.6, unit: '份(150g)' },
        { id: 'spinach', name: '菠菜', cat: '蔬菜', cal: 28, pro: 2.6, carb: 3.6, fat: 0.3, unit: '份(150g)' },
        { id: 'tomato', name: '番茄', cat: '蔬菜', cal: 18, pro: 0.9, carb: 3.5, fat: 0.2, unit: '个(200g)' },
        { id: 'cucumber', name: '黄瓜', cat: '蔬菜', cal: 16, pro: 0.7, carb: 2.9, fat: 0.2, unit: '根(200g)' },
        { id: 'carrot', name: '胡萝卜', cat: '蔬菜', cal: 37, pro: 1.0, carb: 8.1, fat: 0.2, unit: '根(150g)' },
        { id: 'lettuce', name: '生菜', cat: '蔬菜', cal: 13, pro: 1.3, carb: 1.8, fat: 0.2, unit: '份(100g)' },
        { id: 'cabbage', name: '白菜', cat: '蔬菜', cal: 17, pro: 1.5, carb: 2.2, fat: 0.2, unit: '份(150g)' },
        { id: 'apple', name: '苹果', cat: '水果', cal: 53, pro: 0.2, carb: 13.7, fat: 0.2, unit: '个(200g)' },
        { id: 'banana', name: '香蕉', cat: '水果', cal: 93, pro: 1.4, carb: 22.0, fat: 0.2, unit: '根(120g)' },
        { id: 'orange', name: '橙子', cat: '水果', cal: 48, pro: 0.8, carb: 11.1, fat: 0.2, unit: '个(200g)' },
        { id: 'grape', name: '葡萄', cat: '水果', cal: 44, pro: 0.5, carb: 10.3, fat: 0.2, unit: '100g' },
        { id: 'watermelon', name: '西瓜', cat: '水果', cal: 31, pro: 0.5, carb: 7.5, fat: 0.1, unit: '块(200g)' },
        { id: 'peanut', name: '花生', cat: '坚果', cal: 567, pro: 25.8, carb: 16.1, fat: 49.2, unit: '30g' },
        { id: 'walnut', name: '核桃', cat: '坚果', cal: 654, pro: 15.2, carb: 9.6, fat: 65.2, unit: '30g' },
        { id: 'almond', name: '杏仁', cat: '坚果', cal: 578, pro: 21.2, carb: 19.7, fat: 50.6, unit: '30g' },
        { id: 'cooking_oil', name: '食用油', cat: '调味', cal: 899, pro: 0, carb: 0, fat: 99.9, unit: '勺(10ml)' },
        { id: 'soy_sauce', name: '生抽', cat: '调味', cal: 53, pro: 5.6, carb: 5.1, fat: 0.1, unit: '勺(10ml)' },
        { id: 'cola', name: '可乐', cat: '饮料', cal: 43, pro: 0, carb: 10.6, fat: 0, unit: '罐(330ml)' },
        { id: 'juice', name: '果汁', cat: '饮料', cal: 45, pro: 0.4, carb: 10.6, fat: 0.1, unit: '杯(250ml)' },
        { id: 'beer', name: '啤酒', cat: '饮料', cal: 36, pro: 0.4, carb: 3.1, fat: 0, unit: '瓶(500ml)' },
        { id: 'chicken_wing', name: '鸡翅', cat: '肉类', cal: 190, pro: 17.4, carb: 0, fat: 12.7, unit: '个(50g)' },
        { id: 'salmon', name: '三文鱼', cat: '肉类', cal: 208, pro: 20.4, carb: 0, fat: 13.4, unit: '100g' },
        { id: 'milk_powder', name: '蛋白粉', cat: '蛋奶', cal: 373, pro: 80.0, carb: 7.0, fat: 1.5, unit: '勺(30g)' }
    ],

    categories() {
        const set = new Set(this.items.map(i => i.cat));
        return [...set];
    },

    search(keyword) {
        if (!keyword) return this.items.slice(0, 12);
        const kw = keyword.toLowerCase();
        return this.items.filter(i =>
            i.name.includes(kw) || i.id.includes(kw) || i.cat.includes(kw)
        ).slice(0, 12);
    },

    getById(id) {
        return this.items.find(i => i.id === id);
    },

    getCustomFoods() {
        try { return JSON.parse(localStorage.getItem('rehab_food_custom') || '[]'); } catch { return []; }
    },

    saveCustomFood(food) {
        const list = this.getCustomFoods();
        list.push({ ...food, id: `custom_${Date.now()}`, cat: '自定义' });
        localStorage.setItem('rehab_food_custom', JSON.stringify(list));
    },

    getAll() {
        return [...this.items, ...this.getCustomFoods()];
    },

    searchAll(keyword) {
        if (!keyword) return this.getAll().slice(0, 16);
        const kw = keyword.toLowerCase();
        return this.getAll().filter(i =>
            i.name.includes(kw) || i.id.includes(kw) || i.cat.includes(kw)
        ).slice(0, 16);
    }
};
