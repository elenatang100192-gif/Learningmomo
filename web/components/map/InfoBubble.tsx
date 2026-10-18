'use client';
// UNIT 大信息卡：来自 Figma "Hello, new friend!" 卡片
// 左下角小字 "UNIT 1 · GREETINGS"，大字标题，副描述，关键词胶囊
export function InfoBubble({
  unitNo,
  category,
  title,
  subtitle,
  keywords = [],
}: {
  unitNo: number;
  category: string;     // 'GREETINGS' | 'ANIMALS' ...
  title: string;        // 'Hello, new friend!'
  subtitle?: string;
  keywords?: string[];  // ['Hello','Name','Happy']
}) {
  return (
    <div className="unit-card p-6 sm:p-7 max-w-[320px] -rotate-1 origin-top-left">
      <div className="text-[#8F78C8] text-sm font-extrabold tracking-wider">
        UNIT {unitNo} · {category.toUpperCase()}
      </div>
      <h2 className="mt-2 text-[#35366B] text-[28px] sm:text-[31px] font-extrabold leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[#7881A5] text-sm sm:text-base leading-snug">
          {subtitle}
        </p>
      )}
      {keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {keywords.map((k) => (
            <span
              key={k}
              className="px-2.5 py-1.5 bg-[#E6F3FF] text-[#5277CA] text-sm font-extrabold rounded-lg"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
