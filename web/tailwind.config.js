/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 新主题色：紫蓝渐变 + 紫罗兰辅助
        brand: {
          // 紫蓝主色（来自 Figma 渐变 #8A7FF1 → #7099F0 → #67B3EF）
          purpleLight: '#A88BFF',
          purple: '#8A7FF1',
          blue: '#7099F0',
          cyan: '#67B3EF',
          // 玻璃态深色（卡片底 / 顶部 bar）
          ink: '#3C3293',
          inkDeep: '#302693',
          // 辅助色
          sun: '#FFD64D',
          orange: '#FF8A3D',
          pink: '#FF8FA3',
          cream: '#FFF7DC',
          // 兼容历史 className：brand-yellow / brand-sky / brand-green
          yellow: '#FCD34D',
          sky: '#BAE6FD',
          green: '#34D399',
          // UNIT 标签圆点
          dot1: '#9A79EF', // greetings
          dot2: '#43CABB', // animals
          dot3: '#FF876E', // colors
          dot4: '#FFC64E', // family
        },
        // 节点圆形配色（来自 Figma）
        node: {
          teal1: '#79E3D1',
          teal2: '#39BCAE',
          tealBase: '#249D96',
          yellow1: '#FFDF67',
          yellow2: '#FFAC52',
          yellowBase: '#E88745',
          blue1: '#AADEFF',
          blue2: '#72ADF1',
          blueBase: '#5685CF',
          gray1: '#D6DCF2',
          gray2: '#A9B2D5',
          grayBase: '#8B96BD',
        },
      },
      fontFamily: {
        kid: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        display: ['"Nunito"', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Figma 上节点阴影：内白光 + 投影 + 8px 实色底 + 白色 outline
        'node-teal': 'inset 0 4px 8px rgba(255,255,255,.75), 0 12px 22px rgba(38,123,128,.20), 0 8px 0 #249D96',
        'node-yellow': '0 19px 32px rgba(92,67,169,.22), 0 11px 0 #E88745, 0 0 0 14px rgba(255,220,85,.45), 0 0 0 7px rgba(255,255,255,.7)',
        'node-blue': 'inset 0 4px 8px rgba(255,255,255,.75), 0 12px 22px rgba(67,84,167,.22), 0 8px 0 #5685CF',
        'node-gray': 'inset 0 4px 8px rgba(255,255,255,.75), 0 12px 22px rgba(67,84,167,.15), 0 8px 0 #8B96BD',
        // 顶部毛玻璃胶囊
        'unit-active': '0 8px 18px rgba(49,54,139,.14), 0 4px 0 rgba(48,54,147,.18)',
        'unit-pill': '0 1px 0 rgba(255,255,255,.12) inset, 0 22px 45px rgba(60,67,160,.16), 0 14px 0 rgba(62,64,158,.12)',
        'unit-card': '0 2px 0 white inset, 0 22px 45px rgba(60,67,160,.16), 0 14px 0 rgba(62,64,158,.12)',
        'soft': '0 8px 24px rgba(62,65,150,.12)',
        'pop': '0 6px 24px rgba(105,80,189,.35)',

        // ===== 学生端暖色阴影（新增，不替换老 token） =====
        'stu-card': '0 5px 0 0 #2A1F1A, 0 14px 30px rgba(120, 70, 30, 0.18)',
        'stu-pop':  '0 5px 0 0 #2A1F1A, 0 10px 22px rgba(255, 138, 61, 0.30)',
        'stu-near': '0 3px 0 0 #2A1F1A',
      },
      borderRadius: { '4xl': '32px' },
      keyframes: {
        popIn: { '0%': { transform: 'scale(.5)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        floatY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
      },
      animation: {
        popIn: 'popIn .35s ease-out',
        floatY: 'floatY 3s ease-in-out infinite',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
