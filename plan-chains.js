// @ts-nocheck
(function () {
    if (window.planChains) return;

    const builtin = [
        {
            id: 'plan-chain-hip-abduction',
            group: '髋外展',
            levels: [
                { lv: 1, name: '康复·侧卧髋外展基础', requiredEquipment: [], hint: '徒手慢速抬腿，保持骨盆稳定' },
                { lv: 2, name: '康复·侧卧髋外展停顿', requiredEquipment: [], hint: '顶点停 2 秒，控制下放' },
                { lv: 3, name: '康复·弹力带髋外展', requiredEquipment: ['band'], hint: '膝上弹力带，避免代偿' },
                { lv: 4, name: '康复·站姿弹力带外展', requiredEquipment: ['band'], hint: '站姿单腿支撑，保持躯干稳定' }
            ]
        },
        {
            id: 'plan-chain-bridge',
            group: '桥式',
            levels: [
                { lv: 1, name: '康复·桥式保持', requiredEquipment: [], hint: '双脚踩稳，抬髋保持' },
                { lv: 2, name: '康复·桥式慢速重复', requiredEquipment: [], hint: '上顶 2 秒再缓慢下放' },
                { lv: 3, name: '康复·弹力带桥式', requiredEquipment: ['band'], hint: '膝外推维持张力' },
                { lv: 4, name: '康复·瑜伽球桥式', requiredEquipment: ['yoga_ball'], hint: '脚跟放球上增加不稳定' }
            ]
        },
        {
            id: 'plan-chain-squat',
            group: '深蹲',
            levels: [
                { lv: 1, name: '康复·椅子辅助深蹲', requiredEquipment: [], hint: '借助椅子控制幅度' },
                { lv: 2, name: '康复·靠墙静蹲', requiredEquipment: [], hint: '保持膝髋对齐' },
                { lv: 3, name: '康复·箱式深蹲', requiredEquipment: [], hint: '箱面触碰即起，稳定发力' },
                { lv: 4, name: '康复·弹力带深蹲', requiredEquipment: ['band'], hint: '弹力带维持膝外推' }
            ]
        },
        {
            id: 'plan-chain-ankle-dorsiflexion',
            group: '踝背屈',
            levels: [
                { lv: 1, name: '康复·踝背屈泵动', requiredEquipment: [], hint: '坐姿踝泵，建立活动度' },
                { lv: 2, name: '康复·跪姿踝背屈前移', requiredEquipment: [], hint: '膝盖向前找墙，脚跟不离地' },
                { lv: 3, name: '康复·弹力带踝背屈', requiredEquipment: ['band'], hint: '弹力带前拉增加阻力' }
            ]
        },
        {
            id: 'plan-chain-shoulder-external-rotation',
            group: '肩外旋',
            levels: [
                { lv: 1, name: '康复·毛巾夹肘肩外旋', requiredEquipment: [], hint: '肘夹毛巾，控制外旋' },
                { lv: 2, name: '康复·弹力带肩外旋', requiredEquipment: ['band'], hint: '小幅度高控制' },
                { lv: 3, name: '康复·90度肩外旋', requiredEquipment: ['band'], hint: '肩外展 90 度进行外旋' }
            ]
        },
        {
            id: 'plan-chain-core-stability',
            group: '核心稳定',
            levels: [
                { lv: 1, name: '康复·死虫基础', requiredEquipment: [], hint: '核心收紧，四肢交替' },
                { lv: 2, name: '康复·死虫停顿', requiredEquipment: [], hint: '伸展终点停顿 2 秒' },
                { lv: 3, name: '康复·瑜伽球死虫', requiredEquipment: ['yoga_ball'], hint: '双手双膝夹球提高稳定需求' },
                { lv: 4, name: '康复·平板触肩', requiredEquipment: [], hint: '减少骨盆晃动' }
            ]
        },
        {
            id: 'plan-chain-lumbar-activation',
            group: '腰椎激活',
            levels: [
                { lv: 1, name: '康复·骨盆前后倾', requiredEquipment: [], hint: '小幅度骨盆控制' },
                { lv: 2, name: '康复·四点跪猫牛', requiredEquipment: [], hint: '呼吸配合脊柱活动' },
                { lv: 3, name: '康复·鸟狗基础', requiredEquipment: [], hint: '对侧伸展保持稳定' }
            ]
        },
        {
            id: 'plan-chain-knee-extension',
            group: '膝伸',
            levels: [
                { lv: 1, name: '康复·坐姿主动伸膝', requiredEquipment: [], hint: '顶点收缩股四头肌' },
                { lv: 2, name: '康复·弹力带终末伸膝', requiredEquipment: ['band'], hint: '膝后侧充分伸直' },
                { lv: 3, name: '康复·直腿抬高', requiredEquipment: [], hint: '保持膝伸直抬腿' }
            ]
        },
        {
            id: 'plan-chain-single-leg-balance',
            group: '单腿平衡',
            levels: [
                { lv: 1, name: '康复·单腿站立', requiredEquipment: [], hint: '扶墙辅助，保持稳定' },
                { lv: 2, name: '康复·单腿站立转头', requiredEquipment: [], hint: '加入头部转动挑战' },
                { lv: 3, name: '康复·平衡垫单腿站立', requiredEquipment: ['balance_pad'], hint: '软垫增加本体感觉挑战' }
            ]
        },
        {
            id: 'plan-chain-thoracic-mobility',
            group: '胸椎活动',
            levels: [
                { lv: 1, name: '康复·开书式', requiredEquipment: [], hint: '侧卧胸椎旋转打开' },
                { lv: 2, name: '康复·泡沫轴胸椎伸展', requiredEquipment: ['foam_roller'], hint: '胸椎段落伸展' },
                { lv: 3, name: '康复·跪姿穿针引线', requiredEquipment: [], hint: '增加胸椎旋转活动' }
            ]
        },
        {
            id: 'plan-chain-hip-flexion',
            group: '髋屈',
            levels: [
                { lv: 1, name: '康复·仰卧抱膝', requiredEquipment: [], hint: '单腿抱膝保持' },
                { lv: 2, name: '康复·站姿抬膝', requiredEquipment: [], hint: '慢速控制髋屈' },
                { lv: 3, name: '康复·弹力带抬膝', requiredEquipment: ['band'], hint: '弹力带增加阻力' }
            ]
        },
        {
            id: 'plan-chain-ankle-plantarflexion',
            group: '踝跖屈',
            levels: [
                { lv: 1, name: '康复·双脚提踵', requiredEquipment: [], hint: '扶墙提踵，控制节奏' },
                { lv: 2, name: '康复·单脚辅助提踵', requiredEquipment: [], hint: '下放过程慢一些' },
                { lv: 3, name: '康复·弹力带跖屈', requiredEquipment: ['band'], hint: '坐姿弹力带脚尖下压' }
            ]
        }
    ];

    const extra = [
        ['cut-chain-hiit-interval', 'HIIT 间歇', ['cut'], ['低冲击开合步', '原地高抬腿', '登山跑', '冲刺间歇']],
        ['cut-chain-superset', '超级组', ['cut'], ['徒手推拉组合', '深蹲俯卧撑组合', '弹力带超级组', '全身超级组']],
        ['cut-chain-circuit', '循环训练', ['cut'], ['三动作循环', '四动作循环', '带跳跃循环', '高密度循环']],
        ['cut-chain-step-climb', '踏步爬升', ['cut'], ['低台阶踏步', '交替踏步', '负重踏步', '间歇爬升']],
        ['cut-chain-rope', '跳绳进阶', ['cut'], ['无绳模拟', '基础跳绳', '交替脚跳', '间歇快跳']],
        ['cut-chain-tabata', 'Tabata', ['cut'], ['20/10 徒手', '20/10 下肢', '20/10 全身', '混合 Tabata']],
        ['cut-chain-burpee', '波比进阶', ['cut'], ['简化波比', '标准波比', '俯卧撑波比', '跳跃波比']],
        ['bulk-chain-push', '推日核心动作', ['bulk'], ['跪姿俯卧撑', '俯卧撑', '下斜俯卧撑', '负重推举']],
        ['bulk-chain-pull', '拉日核心动作', ['bulk'], ['弹力带划船', '俯身划船', '单臂划船', '引体向上进阶']],
        ['bulk-chain-leg', '腿日核心动作', ['bulk'], ['箱式深蹲', '深蹲', '保加利亚分腿蹲', '负重深蹲']],
        ['bulk-chain-5x5', '5×5 力量周期', ['bulk'], ['技术 5×5', '基础 5×5', '递增 5×5', '高强度 5×5']],
        ['bulk-chain-pyramid', '金字塔组', ['bulk'], ['轻重量热身', '递增金字塔', '反向金字塔', '混合金字塔']],
        ['bulk-chain-intensity', '强度递增', ['bulk'], ['固定重量', '小幅加重', '顶组回退', '高强度顶组']],
        ['maintenance-chain-dynamic-stretch', '动态拉伸', ['maintenance'], ['肩髋动态热身', '全身动态拉伸', '弹力带动态拉伸']],
        ['maintenance-chain-mobility', '关节活动度', ['maintenance'], ['踝髋肩活动', '胸椎髋活动', '全身关节流动']],
        ['maintenance-chain-balance', '平衡进阶', ['maintenance'], ['双脚稳定', '单腿稳定', '平衡垫稳定']],
        ['maintenance-chain-low-cardio', '低强度有氧', ['maintenance'], ['10 分钟轻走', '20 分钟快走', '30 分钟低强度']],
        ['custom-chain-general', '自定义训练链', ['custom'], ['基础动作', '增加组数', '增加时长', '组合训练']]
    ].map(([id, group, applicableTypes, names]) => ({
        id,
        group,
        applicableTypes,
        levels: names.map((name, index) => ({
            lv: index + 1,
            name,
            requiredEquipment: index >= 2 && /弹力带|划船|拉伸/.test(name) ? ['band'] : [],
            hint: `${group} Lv${index + 1}`
        }))
    }));
    builtin.push(...extra);
    builtin.forEach((chain) => {
        chain.applicableTypes = Array.isArray(chain.applicableTypes) && chain.applicableTypes.length
            ? chain.applicableTypes
            : ['rehab', 'maintenance'];
    });

    window.planChains = {
        builtin,
        find(chainId = '') {
            return builtin.find((item) => item.id === chainId) || null;
        }
    };
})();
