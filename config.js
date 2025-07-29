export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;
export const COLORS = [
    null,           // 空值
    '#FF0D72',      // I - 红色
    '#0DC2FF',      // O - 青色
    '#0DFF72',      // T - 绿色
    '#F538FF',      // S - 粉色
    '#FF8E0D',      // Z - 橙色
    '#FFE138',      // J - 黄色
    '#3877FF'       // L - 蓝色
];
export const INITIAL_DROP_INTERVAL = 1000; // 初始下降间隔 (ms)
export const DROP_INTERVAL_DECREMENT = 100; // 每级减少的间隔
export const MIN_DROP_INTERVAL = 100;      // 最小下降间隔
export const LEVEL_UP_LINES = 10;    // 每多少行升级
export const LINES_SCORE = [0, 1, 3, 5, 8];