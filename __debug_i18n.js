import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/i18n/index.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=30835bb5"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/board-game-score-pad/src/i18n/index.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=30835bb5"; const createContext = __vite__cjsImport3_react["createContext"]; const useContext = __vite__cjsImport3_react["useContext"]; const useState = __vite__cjsImport3_react["useState"];
export const LanguageContext = createContext(void 0);
export const LanguageProvider = ({ children }) => {
  _s();
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem("app_language");
    if (saved === "en" || saved === "zh-TW") return saved;
    const browserLang = navigator.language;
    return browserLang.startsWith("zh") ? "zh-TW" : "en";
  });
  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };
  return /* @__PURE__ */ jsxDEV(LanguageContext.Provider, { value: { language, setLanguage }, children }, void 0, false, {
    fileName: "C:/board-game-score-pad/src/i18n/index.tsx",
    lineNumber: 49,
    columnNumber: 5
  }, this);
};
_s(LanguageProvider, "0S9qo/PFoU3TWH20sm1162ffE24=");
_c = LanguageProvider;
export const useTranslation = () => {
  _s2();
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};
_s2(useTranslation, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
$RefreshReg$(_c, "LanguageProvider");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/board-game-score-pad/src/i18n/index.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/board-game-score-pad/src/i18n/index.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBNkJROzs7Ozs7Ozs7Ozs7Ozs7OztBQTVCUixTQUFnQkEsZUFBZUMsWUFBWUMsZ0JBQTJCO0FBVy9ELGFBQU1DLGtCQUFrQkgsY0FBK0NJLE1BQVM7QUFFaEYsYUFBTUMsbUJBQXNEQSxDQUFDLEVBQUVDLFNBQVMsTUFBTTtBQUFBQyxLQUFBO0FBRWpGLFFBQU0sQ0FBQ0MsVUFBVUMsZ0JBQWdCLElBQUlQLFNBQW1CLE1BQU07QUFDMUQsVUFBTVEsUUFBUUMsYUFBYUMsUUFBUSxjQUFjO0FBQ2pELFFBQUlGLFVBQVUsUUFBUUEsVUFBVSxRQUFTLFFBQU9BO0FBQ2hELFVBQU1HLGNBQWNDLFVBQVVOO0FBQzlCLFdBQU9LLFlBQVlFLFdBQVcsSUFBSSxJQUFJLFVBQVU7QUFBQSxFQUNwRCxDQUFDO0FBRUQsUUFBTUMsY0FBY0EsQ0FBQ0MsU0FBbUI7QUFDcENSLHFCQUFpQlEsSUFBSTtBQUNyQk4saUJBQWFPLFFBQVEsZ0JBQWdCRCxJQUFJO0FBQUEsRUFDN0M7QUFFQSxTQUNJLHVCQUFDLGdCQUFnQixVQUFoQixFQUF5QixPQUFPLEVBQUVULFVBQVVRLFlBQVksR0FDcERWLFlBREw7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUVBO0FBRVI7QUFFQUMsR0FyQmFGLGtCQUFtRDtBQUFBLEtBQW5EQTtBQXNCTixhQUFNYyxpQkFBaUJBLE1BQU07QUFBQUMsTUFBQTtBQUNoQyxRQUFNQyxVQUFVcEIsV0FBV0UsZUFBZTtBQUMxQyxNQUFJLENBQUNrQixTQUFTO0FBQ1YsVUFBTSxJQUFJQyxNQUFNLHVEQUF1RDtBQUFBLEVBQzNFO0FBQ0EsU0FBT0Q7QUFDWDtBQUFFRCxJQU5XRCxnQkFBYztBQUFBLElBQUFJO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbImNyZWF0ZUNvbnRleHQiLCJ1c2VDb250ZXh0IiwidXNlU3RhdGUiLCJMYW5ndWFnZUNvbnRleHQiLCJ1bmRlZmluZWQiLCJMYW5ndWFnZVByb3ZpZGVyIiwiY2hpbGRyZW4iLCJfcyIsImxhbmd1YWdlIiwic2V0TGFuZ3VhZ2VTdGF0ZSIsInNhdmVkIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsImJyb3dzZXJMYW5nIiwibmF2aWdhdG9yIiwic3RhcnRzV2l0aCIsInNldExhbmd1YWdlIiwibGFuZyIsInNldEl0ZW0iLCJ1c2VUcmFuc2xhdGlvbiIsIl9zMiIsImNvbnRleHQiLCJFcnJvciIsIl9jIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbImluZGV4LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuaW1wb3J0IFJlYWN0LCB7IGNyZWF0ZUNvbnRleHQsIHVzZUNvbnRleHQsIHVzZVN0YXRlLCBSZWFjdE5vZGUgfSBmcm9tICdyZWFjdCc7XHJcblxyXG4vLyAtLS0gMS4g5Z6L5Yil5a6a576pIC0tLVxyXG5leHBvcnQgdHlwZSBMYW5ndWFnZSA9ICd6aC1UVycgfCAnZW4nO1xyXG5cclxuaW50ZXJmYWNlIExhbmd1YWdlQ29udGV4dFR5cGUge1xyXG4gICAgbGFuZ3VhZ2U6IExhbmd1YWdlO1xyXG4gICAgc2V0TGFuZ3VhZ2U6IChsYW5nOiBMYW5ndWFnZSkgPT4gdm9pZDtcclxufVxyXG5cclxuLy8gLS0tIDIuIENvbnRleHQgJiBQcm92aWRlciAtLS1cclxuZXhwb3J0IGNvbnN0IExhbmd1YWdlQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8TGFuZ3VhZ2VDb250ZXh0VHlwZSB8IHVuZGVmaW5lZD4odW5kZWZpbmVkKTtcclxuXHJcbmV4cG9ydCBjb25zdCBMYW5ndWFnZVByb3ZpZGVyOiBSZWFjdC5GQzx7IGNoaWxkcmVuOiBSZWFjdE5vZGUgfT4gPSAoeyBjaGlsZHJlbiB9KSA9PiB7XHJcbiAgICAvLyDlhKrlhYjoroDlj5YgTG9jYWxTdG9yYWdl77yM5ZCm5YmH5YG15ris54CP6Ka95Zmo6Kqe6KiA77yM6aCQ6KitIHpoLVRXXHJcbiAgICBjb25zdCBbbGFuZ3VhZ2UsIHNldExhbmd1YWdlU3RhdGVdID0gdXNlU3RhdGU8TGFuZ3VhZ2U+KCgpID0+IHtcclxuICAgICAgICBjb25zdCBzYXZlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdhcHBfbGFuZ3VhZ2UnKTtcclxuICAgICAgICBpZiAoc2F2ZWQgPT09ICdlbicgfHwgc2F2ZWQgPT09ICd6aC1UVycpIHJldHVybiBzYXZlZDtcclxuICAgICAgICBjb25zdCBicm93c2VyTGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcclxuICAgICAgICByZXR1cm4gYnJvd3Nlckxhbmcuc3RhcnRzV2l0aCgnemgnKSA/ICd6aC1UVycgOiAnZW4nO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2V0TGFuZ3VhZ2UgPSAobGFuZzogTGFuZ3VhZ2UpID0+IHtcclxuICAgICAgICBzZXRMYW5ndWFnZVN0YXRlKGxhbmcpO1xyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdhcHBfbGFuZ3VhZ2UnLCBsYW5nKTtcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIChcclxuICAgICAgICA8TGFuZ3VhZ2VDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt7IGxhbmd1YWdlLCBzZXRMYW5ndWFnZSB9fT5cclxuICAgICAgICAgICAge2NoaWxkcmVufVxyXG4gICAgICAgIDwvTGFuZ3VhZ2VDb250ZXh0LlByb3ZpZGVyPlxyXG4gICAgKTtcclxufTtcclxuXHJcbi8vIC0tLSAzLiBDdXN0b20gSG9vayAtLS1cclxuZXhwb3J0IGNvbnN0IHVzZVRyYW5zbGF0aW9uID0gKCkgPT4ge1xyXG4gICAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoTGFuZ3VhZ2VDb250ZXh0KTtcclxuICAgIGlmICghY29udGV4dCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndXNlVHJhbnNsYXRpb24gbXVzdCBiZSB1c2VkIHdpdGhpbiBhIExhbmd1YWdlUHJvdmlkZXInKTtcclxuICAgIH1cclxuICAgIHJldHVybiBjb250ZXh0O1xyXG59O1xyXG4iXSwiZmlsZSI6IkM6L2JvYXJkLWdhbWUtc2NvcmUtcGFkL3NyYy9pMThuL2luZGV4LnRzeCJ9