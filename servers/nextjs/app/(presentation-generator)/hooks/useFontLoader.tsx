
export const useFontLoader = ( fonts:string[]) => {
    const injectFonts = (fontUrls: string[]) => {
        const appOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5001";
        fontUrls.forEach((fontUrl) => {
          if (!fontUrl) return;
          let newFontUrl = fontUrl.includes('fonts.googleapis') ? fontUrl : `${appOrigin}${fontUrl}`;
          const existingStyle = document.querySelector(`style[data-font-url="${newFontUrl}"]`);
          if (existingStyle) return;
          const style = document.createElement("style");
          style.setAttribute("data-font-url", newFontUrl);
          style.textContent = `@import url('${newFontUrl}');`;
          document.head.appendChild(style);
        });
      };
      injectFonts(fonts);
};
