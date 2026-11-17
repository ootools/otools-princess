/**
 * 公主换装乐园 · 数据层（纯 JS / ESM）
 * ------------------------------------------------------------------
 * 全部内容离线内置，无网络、无 SDK 依赖。
 *   - 50 位公主 = 5 主题 × 10
 *   - 118 件独立造型部件 = 8 大类（同款换色不另计件）
 *   - 12 个梦幻场景
 *   - 4 套主题套装加成
 * 每个部件用 variant 指定独立轮廓/结构，render.mjs 据此绘制。
 */

export const THEMES = {
  rose: { id: 'rose', name: '玫瑰花园', color: '#FF79B0', soft: '#FFE3EF', accent: '#D84F8C' },
  ocean: { id: 'ocean', name: '海洋人鱼', color: '#4FC3E8', soft: '#DDF5FF', accent: '#2A93BF' },
  star: { id: 'star', name: '星夜魔法', color: '#A98BFF', soft: '#EEE7FF', accent: '#7B5FD1' },
  garden: { id: 'garden', name: '花园茶会', color: '#FFC45C', soft: '#FFF0CE', accent: '#D79A2E' },
  forest: { id: 'forest', name: '森林仙子', color: '#6FD3A0', soft: '#DEF7EA', accent: '#3CA874' },
};

/** 稀有度：普通 / 稀有 / 闪亮 / 限定 —— 合计 118 */
export const RARITY = {
  common: { id: 'common', name: '普通', color: '#9B8AB5', stars: 1 },
  rare: { id: 'rare', name: '稀有', color: '#4FA9E0', stars: 2 },
  shiny: { id: 'shiny', name: '闪亮', color: '#C77BE0', stars: 3 },
  limited: { id: 'limited', name: '限定', color: '#E5A93A', stars: 5 },
};

export const CATEGORIES = [
  { id: 'hair', name: '发型', icon: '💇', color: '#FF79B0' },
  { id: 'gown', name: '礼服', icon: '👗', color: '#E86FA8' },
  { id: 'top', name: '上衣', icon: '👚', color: '#B57BE0' },
  { id: 'shoes', name: '鞋子', icon: '👠', color: '#6FB7E8' },
  { id: 'headwear', name: '头饰', icon: '👑', color: '#FFC45C' },
  { id: 'jewelry', name: '首饰', icon: '📿', color: '#E88FB8' },
  { id: 'prop', name: '道具', icon: '🪄', color: '#7ED0B0' },
  { id: 'wings', name: '翅膀/宠物', icon: '🦋', color: '#9AA8F0' },
];

/** 部件造型配方表：[id, 名称, variant, 主色, 稀有度] */
const RECIPES = {
  hair: [
    ['hair-long-wave', '蜂蜜长卷发', 'longWave', '#C9783E', 'common'],
    ['hair-twin-bun', '双丸子头', 'twinBun', '#7A4B2E', 'common'],
    ['hair-high-pony', '高马尾', 'highPony', '#E0A24A', 'common'],
    ['hair-short-bob', '波波短发', 'bob', '#5A3A2A', 'common'],
    ['hair-braid', '侧麻花辫', 'braid', '#8A5A34', 'common'],
    ['hair-straight', '银白长直发', 'longStraight', '#D8D3DC', 'rare'],
    ['hair-curly', '蓬蓬卷发', 'curly', '#B4603A', 'common'],
    ['hair-space-bun', '双球星际头', 'spaceBun', '#9B7BE0', 'shiny'],
    ['hair-bob-clips', '夹发波波头', 'bobClips', '#4A3428', 'common'],
    ['hair-flower-updo', '花环盘发', 'flowerUpdo', '#8C4A2E', 'rare'],
    ['hair-twin-tail', '双马尾', 'twinTail', '#D98A4A', 'common'],
    ['hair-mermaid', '海藻波浪发', 'mermaid', '#3FA9A0', 'rare'],
    ['hair-rose-curl', '玫瑰卷刘海', 'roseCurl', '#C85C86', 'shiny'],
    ['hair-gold-long', '鎏金长发', 'goldLong', '#E5B44A', 'limited'],
    ['hair-snow-bob', '雪精灵短发', 'snowBob', '#BFE4F5', 'shiny'],
    ['hair-star-long', '星尘长发', 'starLong', '#7E6AD1', 'limited'],
    ['hair-chestnut', '栗子齐刘海', 'chestnut', '#6B4028', 'common'],
    ['hair-peach-updo', '蜜桃盘发', 'peachUpdo', '#E08B7A', 'rare'],
  ],
  gown: [
    ['gown-ball-rose', '玫瑰蓬蓬裙', 'ball', '#F07AAE', 'common'],
    ['gown-mermaid-ocean', '人鱼尾礼服', 'mermaid', '#43B9D6', 'rare'],
    ['gown-aline-star', '星夜A字裙', 'aline', '#9B7BE0', 'rare'],
    ['gown-tiered-garden', '花园蛋糕裙', 'tiered', '#F2B24C', 'common'],
    ['gown-tutu-forest', '森林纱纱裙', 'tutu', '#6FCF9B', 'common'],
    ['gown-column-pearl', '珍珠直筒裙', 'column', '#EAD9E2', 'rare'],
    ['gown-princess-sleeve', '公主泡泡袖裙', 'princessSleeve', '#EE86BC', 'shiny'],
    ['gown-short-party', '短款舞会裙', 'short', '#F4A0C6', 'common'],
    ['gown-train-lilac', '丁香拖尾裙', 'train', '#B29AE8', 'shiny'],
    ['gown-ruffle-rose', '玫瑰荷叶裙', 'ruffle', '#D96092', 'rare'],
    ['gown-sunflower', '向日葵茶会裙', 'sunflower', '#F6C244', 'rare'],
    ['gown-ice', '冰雪长裙', 'ice', '#A8DFF2', 'shiny'],
    ['gown-lace-cream', '奶油蕾丝裙', 'lace', '#F6E4DA', 'common'],
    ['gown-golden', '鎏金礼服', 'golden', '#E8B23C', 'limited'],
    ['gown-candy', '糖果条纹裙', 'candy', '#F19AC1', 'common'],
    ['gown-velvet', '天鹅绒晚礼服', 'velvet', '#8E5AA8', 'shiny'],
    ['gown-butterfly', '蝴蝶结纱裙', 'butterfly', '#C98BE0', 'rare'],
    ['gown-moon', '月光丝绸裙', 'moon', '#AEB8F0', 'limited'],
    ['gown-apple', '苹果短裙', 'apple', '#E86A6A', 'common'],
    ['gown-sage', '鼠尾草长裙', 'sage', '#9CC9A8', 'common'],
  ],
  top: [
    ['top-round-tee', '圆领短袖衫', 'roundTee', '#F5A8C8', 'common'],
    ['top-sailor', '水手领上衣', 'sailor', '#7FB4E8', 'common'],
    ['top-puff-blouse', '泡泡袖衬衫', 'puffBlouse', '#EFA0C2', 'rare'],
    ['top-camisole', '蕾丝吊带', 'camisole', '#F3D3E2', 'common'],
    ['top-hooded', '连帽小外套', 'hooded', '#9FD3B4', 'common'],
    ['top-ruffle-collar', '荷叶领衬衫', 'ruffleCollar', '#F4B8D2', 'rare'],
    ['top-capelet', '蝴蝶结小披肩', 'capelet', '#C7A6EC', 'shiny'],
    ['top-v-vest', 'V领小马甲', 'vVest', '#8FBEE8', 'common'],
    ['top-offshoulder', '一字肩上衣', 'offShoulder', '#F0A0B8', 'rare'],
    ['top-turtleneck', '高领针织衫', 'turtleneck', '#F2D9A0', 'common'],
    ['top-lace-blouse', '蕾丝花边衬衫', 'laceBlouse', '#F6E0E8', 'rare'],
    ['top-double-breasted', '双排扣外套', 'doubleBreasted', '#A9BCE0', 'common'],
    ['top-wrap', '交叉裹身上衣', 'wrap', '#E7A0C8', 'common'],
    ['top-armor', '闪亮肩甲', 'armor', '#C0B6E8', 'shiny'],
    ['top-pinafore', '背带围裙', 'pinafore', '#F0C08A', 'common'],
    ['top-flared-sleeve', '喇叭袖上衣', 'flaredSleeve', '#C99CEC', 'rare'],
    ['top-knit', '麻花毛衣', 'knit', '#EFCB92', 'common'],
    ['top-long-cape', '长款斗篷', 'longCape', '#9E8BD8', 'shiny'],
    ['top-bubble', '泡泡短上衣', 'bubble', '#F2A6C4', 'common'],
    ['top-tiered-cake', '层叠蛋糕上衣', 'tieredCake', '#EFA8D0', 'rare'],
    ['top-bow-tie', '蝴蝶结领上衣', 'bowTie', '#F6C0D6', 'common'],
    ['top-suspender', '背带扣上衣', 'suspender', '#A8CDEA', 'common'],
    ['top-cardigan', '开衫小外套', 'cardigan', '#F1D4A8', 'common'],
    ['top-golden-bolero', '鎏金短外套', 'goldenBolero', '#E8C25A', 'limited'],
  ],
  shoes: [
    ['shoes-bow', '蝴蝶结公主鞋', 'bow', '#F2A8C6', 'common'],
    ['shoes-crystal', '水晶鞋', 'crystal', '#CFE8F5', 'shiny'],
    ['shoes-boots', '小皮靴', 'boots', '#A06A48', 'common'],
    ['shoes-ballet', '芭蕾舞鞋', 'ballet', '#F4BED4', 'common'],
    ['shoes-sandal', '珍珠凉鞋', 'sandal', '#EAD3B0', 'common'],
    ['shoes-mermaid', '人鱼脚蹼鞋', 'mermaid', '#4FC3C0', 'rare'],
    ['shoes-star', '星星魔法鞋', 'star', '#A98BEA', 'shiny'],
    ['shoes-rose', '玫瑰花鞋', 'rose', '#E07AA6', 'rare'],
    ['shoes-gold', '黄金舞鞋', 'gold', '#E8C048', 'limited'],
    ['shoes-snow', '雪绒靴', 'snow', '#CFE9F4', 'shiny'],
    ['shoes-garden', '花园布鞋', 'garden', '#9BCFAE', 'common'],
    ['shoes-lace', '蕾丝长靴', 'lace', '#F0DCE6', 'rare'],
  ],
  headwear: [
    ['head-tiara', '水晶皇冠', 'tiara', '#F2D259', 'shiny'],
    ['head-flower-crown', '花环', 'flowerCrown', '#F29AC0', 'common'],
    ['head-bow', '大蝴蝶结', 'bow', '#EE86B4', 'common'],
    ['head-star-clips', '星星发夹', 'starClips', '#B49AEC', 'rare'],
    ['head-bonnet', '花朵软帽', 'bonnet', '#F3C97A', 'rare'],
    ['head-witch-hat', '魔法尖帽', 'witchHat', '#9A7AD8', 'shiny'],
    ['head-shell-crown', '贝壳皇冠', 'shellCrown', '#67C7C4', 'rare'],
    ['head-rose-band', '玫瑰花环', 'roseBand', '#DC6E9C', 'common'],
    ['head-pearl-band', '珍珠发箍', 'pearlBand', '#EFE2EA', 'rare'],
    ['head-angel-halo', '天使光环', 'halo', '#F5DE8C', 'limited'],
    ['head-leaf-crown', '树叶花冠', 'leafCrown', '#7ECB9C', 'common'],
    ['head-moon-clip', '月牙发饰', 'moonClip', '#C0B8F0', 'shiny'],
    ['head-candy-bow', '糖果发带', 'candyBow', '#F4A0C4', 'common'],
    ['head-gold-tiara', '鎏金王冠', 'goldTiara', '#E9BE4A', 'limited'],
  ],
  jewelry: [
    ['jewel-pearl-necklace', '珍珠项链', 'pearlNecklace', '#F0E2EA', 'common'],
    ['jewel-gem-necklace', '宝石项链', 'gemNecklace', '#7FCFE8', 'rare'],
    ['jewel-bow-choker', '蝴蝶结颈链', 'bowChoker', '#EE9AC0', 'common'],
    ['jewel-star-pendant', '星星吊坠', 'starPendant', '#B49CEC', 'shiny'],
    ['jewel-earrings', '圆珠耳环', 'earrings', '#F2D078', 'common'],
    ['jewel-rose-choker', '玫瑰颈饰', 'roseChoker', '#DC7EA8', 'rare'],
    ['jewel-bracelet', '珠链手环', 'bracelet', '#EFD9A0', 'common'],
    ['jewel-brooch', '闪亮胸针', 'brooch', '#A8D8EE', 'rare'],
    ['jewel-moon-pendant', '月牙吊坠', 'moonPendant', '#C9BEF2', 'shiny'],
    ['jewel-gold-set', '鎏金首饰套装', 'goldSet', '#E9C154', 'limited'],
  ],
  prop: [
    ['prop-star-wand', '星星魔法棒', 'starWand', '#B79AEC', 'common'],
    ['prop-ribbon-wand', '丝带仙女棒', 'ribbonWand', '#F2A8C8', 'common'],
    ['prop-parasol', '蕾丝阳伞', 'parasol', '#F0C6D8', 'rare'],
    ['prop-flower-basket', '鲜花花篮', 'flowerBasket', '#F2B06A', 'common'],
    ['prop-mirror', '魔镜', 'mirror', '#CFE0F0', 'rare'],
    ['prop-book', '魔法书', 'book', '#A88ED8', 'shiny'],
    ['prop-balloon', '爱心气球', 'balloon', '#F29ABA', 'common'],
    ['prop-staff', '珍珠权杖', 'staff', '#EED678', 'shiny'],
    ['prop-fan', '羽毛扇', 'fan', '#C9E0D4', 'common'],
    ['prop-candy', '糖果手杖', 'candy', '#F4A0C0', 'common'],
    ['prop-lantern', '星光提灯', 'lantern', '#E8C968', 'shiny'],
    ['prop-crown-scepter', '黄金权杖', 'crownScepter', '#E9C04A', 'limited'],
  ],
  wings: [
    ['wings-butterfly', '蝴蝶翅膀', 'butterfly', '#C79CEC', 'common'],
    ['wings-angel', '天使羽翼', 'angel', '#F0E6D8', 'shiny'],
    ['wings-fairy', '精灵薄翼', 'fairy', '#A8E0D0', 'rare'],
    ['wings-star', '星光之翼', 'star', '#B4A2F0', 'shiny'],
    ['wings-flower', '花瓣之翼', 'flower', '#F2AEC8', 'rare'],
    ['wings-cat', '小猫伙伴', 'cat', '#E8B27A', 'common'],
    ['wings-bunny', '小兔伙伴', 'bunny', '#F0DCE2', 'common'],
    ['wings-unicorn', '独角兽伙伴', 'unicorn', '#CFB8EE', 'limited'],
  ],
};

/** 展开成完整部件对象，自动编号、计算默认解锁 */
function buildParts() {
  const list = [];
  for (const cat of CATEGORIES) {
    const recipes = RECIPES[cat.id] || [];
    recipes.forEach(([id, name, variant, color, rarity], index) => {
      list.push({
        id,
        name,
        category: cat.id,
        categoryName: cat.name,
        variant,
        color,
        rarity,
        // 每类前若干件默认解锁，越稀有越晚解锁
        unlocked: rarity === 'common' || (rarity === 'rare' && index < 3),
      });
    });
  }
  return list;
}

export const PARTS = buildParts();
export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));

/** 12 个梦幻场景 */
export const SCENES = [
  { id: 'scene-castle', name: '城堡舞会', variant: 'castle', color: '#FCE6F0' },
  { id: 'scene-sakura', name: '樱花庭院', variant: 'sakura', color: '#FFE9EF' },
  { id: 'scene-star', name: '星空露台', variant: 'star', color: '#E7E1FB' },
  { id: 'scene-beach', name: '海边沙滩', variant: 'beach', color: '#DDF3F7' },
  { id: 'scene-candy', name: '糖果厨房', variant: 'candy', color: '#FDE9F3' },
  { id: 'scene-forest', name: '魔法森林', variant: 'forest', color: '#E2F5E8' },
  { id: 'scene-ice', name: '冰雪王国', variant: 'ice', color: '#E4F3FA' },
  { id: 'scene-tea', name: '花园茶会', variant: 'tea', color: '#FFF0D6' },
  { id: 'scene-ocean', name: '海底世界', variant: 'ocean', color: '#DCF2F6' },
  { id: 'scene-cloud', name: '云端城堡', variant: 'cloud', color: '#EDF0FC' },
  { id: 'scene-pumpkin', name: '南瓜马车', variant: 'pumpkin', color: '#FBEAD7' },
  { id: 'scene-moon', name: '月光湖畔', variant: 'moon', color: '#E6E6F6' },
];
export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]));

/** 套装加成：凑齐同主题 4 件核心部件 */
export const SETS = [
  { id: 'set-rose', name: '玫瑰舞会', theme: 'rose', color: '#E86FA8', parts: ['hair-rose-curl', 'gown-ball-rose', 'head-rose-band', 'prop-ribbon-wand'] },
  { id: 'set-ocean', name: '海洋人鱼', theme: 'ocean', color: '#3FA9C9', parts: ['hair-mermaid', 'gown-mermaid-ocean', 'head-shell-crown', 'prop-staff'] },
  { id: 'set-star', name: '星夜魔法', theme: 'star', color: '#8B6FD1', parts: ['hair-star-long', 'gown-aline-star', 'head-star-clips', 'prop-star-wand'] },
  { id: 'set-garden', name: '花园茶会', theme: 'garden', color: '#D79A2E', parts: ['hair-flower-updo', 'gown-sunflower', 'head-bonnet', 'prop-flower-basket'] },
];

/** 50 位公主 = 5 主题 × 10 */
const PRINCESS_NAMES = {
  rose: ['露娜', '艾拉', '贝拉', '莉莉', '萝丝', '薇拉', '米娅', '索菲', '妮娜', '克拉拉'],
  ocean: ['珊瑚', '珍珠', '汐汐', '蓝蓝', '海薇', '安琪', '浪浪', '贝贝', '涟涟', '沐沐'],
  star: ['星黛', '紫菱', '闪闪', '月牙', '艾薇', '夜瞳', '银河', '星语', '琉璃', '梦梦'],
  garden: ['茶茶', '蜜桃', '奶油', '可可', '莉娅', '温妮', '艾米', '果果', '甜甜', 'Rose'],
  forest: ['林林', '苔苔', '蘑菇', '萤火', '松鼠', '露露', '森森', '叶子', '晨曦', '小鹿'],
};

const SKINS = ['#FFE0C4', '#FFD3AE', '#F6C9A0', '#E8B98E', '#FBD9BE'];

function buildPrincesses() {
  const list = [];
  const themeIds = Object.keys(THEMES);
  themeIds.forEach((themeId, ti) => {
    const names = PRINCESS_NAMES[themeId];
    names.forEach((name, i) => {
      const theme = THEMES[themeId];
      const partsByCat = (cat) => (RECIPES[cat] || []).map((r) => r[0]);
      const pick = (cat, offset) => {
        const arr = partsByCat(cat);
        return arr[(i + offset) % arr.length];
      };
      list.push({
        id: `princess-${themeId}-${i + 1}`,
        name,
        theme: themeId,
        themeName: theme.name,
        themeColor: theme.color,
        skin: SKINS[(ti + i) % SKINS.length],
        // 每位公主的默认搭配：主题内轮转，保证初始就好看且各不相同
        outfit: {
          hair: pick('hair', ti),
          gown: pick('gown', ti + 1),
          top: i % 4 === 0 ? pick('top', 0) : null, // 多数不穿上衣，直接穿礼服
          shoes: pick('shoes', ti),
          headwear: pick('headwear', ti + 2),
          jewelry: pick('jewelry', i % 2),
          prop: pick('prop', ti + 1),
          wings: i % 3 === 0 ? pick('wings', ti) : null,
        },
      });
    });
  });
  return list;
}

export const PRINCESSES = buildPrincesses();
export const PRINCESS_BY_ID = new Map(PRINCESSES.map((p) => [p.id, p]));

export const COUNTS = {
  princesses: PRINCESSES.length,
  parts: PARTS.length,
  scenes: SCENES.length,
  sets: SETS.length,
  byCategory: Object.fromEntries(CATEGORIES.map((c) => [c.id, PARTS.filter((p) => p.category === c.id).length])),
  byRarity: Object.fromEntries(Object.keys(RARITY).map((r) => [r, PARTS.filter((p) => p.rarity === r).length])),
};
