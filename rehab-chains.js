// @ts-nocheck
(function () {
    if (window.rehabChains) return;

    const builtin = [
        {
            id: 'rehab-chain-hip-abduction',
            group: '髋外展',
            levels: [
                { lv: 1, name: '康复·侧卧髋外展基础', requiredEquipment: [], hint: '徒手慢速抬腿，保持骨盆稳定' },
                { lv: 2, name: '康复·侧卧髋外展停顿', requiredEquipment: [], hint: '顶点停 2 秒，控制下放' },
                { lv: 3, name: '康复·弹力带髋外展', requiredEquipment: ['band'], hint: '膝上弹力带，避免代偿' },
                { lv: 4, name: '康复·站姿弹力带外展', requiredEquipment: ['band'], hint: '站姿单腿支撑，保持躯干稳定' }
            ]
        },
        {
            id: 'rehab-chain-bridge',
            group: '桥式',
            levels: [
                { lv: 1, name: '康复·桥式保持', requiredEquipment: [], hint: '双脚踩稳，抬髋保持' },
                { lv: 2, name: '康复·桥式慢速重复', requiredEquipment: [], hint: '上顶 2 秒再缓慢下放' },
                { lv: 3, name: '康复·弹力带桥式', requiredEquipment: ['band'], hint: '膝外推维持张力' },
                { lv: 4, name: '康复·瑜伽球桥式', requiredEquipment: ['yoga_ball'], hint: '脚跟放球上增加不稳定' }
            ]
        },
        {
            id: 'rehab-chain-squat',
            group: '深蹲',
            levels: [
                { lv: 1, name: '康复·椅子辅助深蹲', requiredEquipment: [], hint: '借助椅子控制幅度' },
                { lv: 2, name: '康复·靠墙静蹲', requiredEquipment: [], hint: '保持膝髋对齐' },
                { lv: 3, name: '康复·箱式深蹲', requiredEquipment: [], hint: '箱面触碰即起，稳定发力' },
                { lv: 4, name: '康复·弹力带深蹲', requiredEquipment: ['band'], hint: '弹力带维持膝外推' }
            ]
        },
        {
            id: 'rehab-chain-ankle-dorsiflexion',
            group: '踝背屈',
            levels: [
                { lv: 1, name: '康复·踝背屈泵动', requiredEquipment: [], hint: '坐姿踝泵，建立活动度' },
                { lv: 2, name: '康复·跪姿踝背屈前移', requiredEquipment: [], hint: '膝盖向前找墙，脚跟不离地' },
                { lv: 3, name: '康复·弹力带踝背屈', requiredEquipment: ['band'], hint: '弹力带前拉增加阻力' }
            ]
        },
        {
            id: 'rehab-chain-shoulder-external-rotation',
            group: '肩外旋',
            levels: [
                { lv: 1, name: '康复·毛巾夹肘肩外旋', requiredEquipment: [], hint: '肘夹毛巾，控制外旋' },
                { lv: 2, name: '康复·弹力带肩外旋', requiredEquipment: ['band'], hint: '小幅度高控制' },
                { lv: 3, name: '康复·90度肩外旋', requiredEquipment: ['band'], hint: '肩外展 90 度进行外旋' }
            ]
        },
        {
            id: 'rehab-chain-core-stability',
            group: '核心稳定',
            levels: [
                { lv: 1, name: '康复·死虫基础', requiredEquipment: [], hint: '核心收紧，四肢交替' },
                { lv: 2, name: '康复·死虫停顿', requiredEquipment: [], hint: '伸展终点停顿 2 秒' },
                { lv: 3, name: '康复·瑜伽球死虫', requiredEquipment: ['yoga_ball'], hint: '双手双膝夹球提高稳定需求' },
                { lv: 4, name: '康复·平板触肩', requiredEquipment: [], hint: '减少骨盆晃动' }
            ]
        },
        {
            id: 'rehab-chain-lumbar-activation',
            group: '腰椎激活',
            levels: [
                { lv: 1, name: '康复·骨盆前后倾', requiredEquipment: [], hint: '小幅度骨盆控制' },
                { lv: 2, name: '康复·四点跪猫牛', requiredEquipment: [], hint: '呼吸配合脊柱活动' },
                { lv: 3, name: '康复·鸟狗基础', requiredEquipment: [], hint: '对侧伸展保持稳定' }
            ]
        },
        {
            id: 'rehab-chain-knee-extension',
            group: '膝伸',
            levels: [
                { lv: 1, name: '康复·坐姿主动伸膝', requiredEquipment: [], hint: '顶点收缩股四头肌' },
                { lv: 2, name: '康复·弹力带终末伸膝', requiredEquipment: ['band'], hint: '膝后侧充分伸直' },
                { lv: 3, name: '康复·直腿抬高', requiredEquipment: [], hint: '保持膝伸直抬腿' }
            ]
        },
        {
            id: 'rehab-chain-single-leg-balance',
            group: '单腿平衡',
            levels: [
                { lv: 1, name: '康复·单腿站立', requiredEquipment: [], hint: '扶墙辅助，保持稳定' },
                { lv: 2, name: '康复·单腿站立转头', requiredEquipment: [], hint: '加入头部转动挑战' },
                { lv: 3, name: '康复·平衡垫单腿站立', requiredEquipment: ['balance_pad'], hint: '软垫增加本体感觉挑战' }
            ]
        },
        {
            id: 'rehab-chain-thoracic-mobility',
            group: '胸椎活动',
            levels: [
                { lv: 1, name: '康复·开书式', requiredEquipment: [], hint: '侧卧胸椎旋转打开' },
                { lv: 2, name: '康复·泡沫轴胸椎伸展', requiredEquipment: ['foam_roller'], hint: '胸椎段落伸展' },
                { lv: 3, name: '康复·跪姿穿针引线', requiredEquipment: [], hint: '增加胸椎旋转活动' }
            ]
        },
        {
            id: 'rehab-chain-hip-flexion',
            group: '髋屈',
            levels: [
                { lv: 1, name: '康复·仰卧抱膝', requiredEquipment: [], hint: '单腿抱膝保持' },
                { lv: 2, name: '康复·站姿抬膝', requiredEquipment: [], hint: '慢速控制髋屈' },
                { lv: 3, name: '康复·弹力带抬膝', requiredEquipment: ['band'], hint: '弹力带增加阻力' }
            ]
        },
        {
            id: 'rehab-chain-ankle-plantarflexion',
            group: '踝跖屈',
            levels: [
                { lv: 1, name: '康复·双脚提踵', requiredEquipment: [], hint: '扶墙提踵，控制节奏' },
                { lv: 2, name: '康复·单脚辅助提踵', requiredEquipment: [], hint: '下放过程慢一些' },
                { lv: 3, name: '康复·弹力带跖屈', requiredEquipment: ['band'], hint: '坐姿弹力带脚尖下压' }
            ]
        }
    ];

    window.rehabChains = {
        builtin,
        find(chainId = '') {
            return builtin.find((item) => item.id === chainId) || null;
        }
    };
})();

