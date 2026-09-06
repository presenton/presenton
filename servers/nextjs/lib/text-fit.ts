// Автоподгонка текста под bounding box. Рамки элементов фиксированы, а
// сгенерированный текст иногда не влезает: рендер обрезал его по границе
// слайда. Скрипт плавно уменьшает font-size до вписывания (с полом), учитывая
// отступы через clientHeight/scrollHeight (box-sizing: border-box).
// Экспорт запускает его как inline-скрипт до измерения DOM, превью — из React.

export const TEXT_FIT_SELECTOR = "[data-presenton-text]";

const TEXT_FIT_DONE_ATTRIBUTE = "data-presenton-text-fit";
const TEXT_FIT_STEP_FACTOR = 0.96;
const TEXT_FIT_MIN_FONT_PX = 10;
const TEXT_FIT_MAX_ITERATIONS = 40;

export function runTextFit(root: ParentNode): void {
  if (typeof document === "undefined") return;
  const elements = root.querySelectorAll<HTMLElement>(TEXT_FIT_SELECTOR);
  elements.forEach((element) => {
    if (element.getAttribute(TEXT_FIT_DONE_ATTRIBUTE) === "done") return;
    element.setAttribute(TEXT_FIT_DONE_ATTRIBUTE, "done");

    const computed = window.getComputedStyle(element);
    const originalSize = Number.parseFloat(computed.fontSize);
    if (!Number.isFinite(originalSize) || originalSize <= TEXT_FIT_MIN_FONT_PX) {
      return;
    }
    // Боксы без явной высоты растут вместе с контентом — подгонять нечего.
    if (!Number.isFinite(element.clientHeight) || element.clientHeight <= 0) {
      return;
    }

    let size = originalSize;
    for (let iteration = 0; iteration < TEXT_FIT_MAX_ITERATIONS; iteration += 1) {
      if (element.scrollHeight <= element.clientHeight + 1) return;
      const nextSize = size * TEXT_FIT_STEP_FACTOR;
      if (nextSize < TEXT_FIT_MIN_FONT_PX) break;
      size = nextSize;
      element.style.fontSize = `${round2(size)}px`;
    }
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Inline-версия для экспортного HTML: экспортный раннер рендерит страницу в
// Chromium и измеряет DOM — подгонка обязана выполниться до измерения.
export function renderTextFitScript(): string {
  return `
<script data-presenton-text-fit>
(function(){
function round2(v){return Math.round(v*100)/100}
function run(root){
var elements=(root||document).querySelectorAll("[data-presenton-text]");
for(var i=0;i<elements.length;i++){
var el=elements[i];
if(el.getAttribute("data-presenton-text-fit")==="done")continue;
el.setAttribute("data-presenton-text-fit","done");
var originalSize=parseFloat(window.getComputedStyle(el).fontSize);
if(!isFinite(originalSize)||originalSize<=10)continue;
if(!isFinite(el.clientHeight)||el.clientHeight<=0)continue;
var size=originalSize;
for(var iteration=0;iteration<40;iteration++){
if(el.scrollHeight<=el.clientHeight+1)break;
var nextSize=size*0.96;
if(nextSize<10)break;
size=nextSize;
el.style.fontSize=round2(size)+"px";
}
}
}
function runAll(){run(document)}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",runAll,{once:true})}else{runAll()}
if(document.fonts&&document.fonts.ready){
document.fonts.ready.then(function(){document.querySelectorAll("[data-presenton-text-fit]").forEach(function(el){el.removeAttribute("data-presenton-text-fit")});runAll()})
}
})();
</script>
`;
}
