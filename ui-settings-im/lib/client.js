window.__ModuleLoader__.load({
	id: "@dsh-extra/dsh-client-ui-settings-im",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  KINDS: () => KINDS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/BotChannelTab.tsx
var import_react4 = require("react");

// src/client/platform-marks.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function MarkImg({ src, size = 26 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "img",
    {
      src,
      width: size,
      height: size,
      alt: "",
      "aria-hidden": "true",
      draggable: false,
      style: { objectFit: "contain" }
    }
  );
}
var FEISHU_PNG = "data:image/png;base64,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";
function WechatMark({ size = 26 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { fill: "#07C160", d: "M9.3 4C5.3 4 2 6.8 2 10.2c0 1.9 1 3.5 2.7 4.6l-.7 2.1 2.4-1.2c.6.2 1.3.3 2 .4-.2-.5-.3-1.1-.3-1.6 0-3.2 3.1-5.7 6.8-5.7h.4C14.7 6 12.2 4 9.3 4zM7.1 8.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm4.5 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { fill: "#07C160", d: "M22 14.4c0-2.8-2.8-5.1-6.1-5.1s-6.1 2.3-6.1 5.1 2.8 5.1 6.1 5.1c.6 0 1.2-.1 1.8-.3l2.1 1-.6-1.8c1.7-.9 2.8-2.4 2.8-4.1zm-8.1-.8c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.4.8-.8.8zm4 0c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.4.8-.8.8z" })
  ] });
}
function FeishuMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarkImg, { ...props, src: FEISHU_PNG });
}
function WecomMark({ size = 26 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "2", y: "2", width: "20", height: "20", rx: "4", fill: "#2A9D8F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { fill: "#FFFFFF", d: "M7 10a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.5l-2 2v-2H8a1 1 0 0 1-1-1v-4z" })
  ] });
}

// src/client/BotChannelTab.module.css
var css = "/* Bot Channel tab: platform cards row + QR/steps split layout. */\r\n\r\n.eiGEEq_section {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 20px;\r\n}\r\n\r\n.eiGEEq_intro {\r\n  margin: 0;\r\n  opacity: 0.75;\r\n}\r\n\r\n.eiGEEq_cards {\r\n  display: grid;\r\n  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));\r\n  gap: 14px;\r\n}\r\n\r\n@media (max-width: 720px) {\r\n  .eiGEEq_cards {\r\n    grid-template-columns: repeat(2, 1fr);\r\n  }\r\n}\r\n\r\n.eiGEEq_card {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 10px;\r\n  padding: 18px 12px 14px;\r\n  border-radius: 12px;\r\n  cursor: pointer;\r\n  background: color-mix(in srgb, currentColor 4%, transparent);\r\n  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);\r\n  transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;\r\n}\r\n\r\n.eiGEEq_card:hover {\r\n  border-color: color-mix(in srgb, currentColor 30%, transparent);\r\n  background: color-mix(in srgb, currentColor 7%, transparent);\r\n}\r\n\r\n.eiGEEq_card:active {\r\n  transform: scale(0.98);\r\n}\r\n\r\n.eiGEEq_card[data-selected='true'] {\r\n  border: 2px solid var(--im-accent, #4a6cf7);\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 8%, transparent);\r\n}\r\n\r\n.eiGEEq_cardIcon {\r\n  display: grid;\r\n  place-items: center;\r\n  width: 44px;\r\n  height: 44px;\r\n  border-radius: 10px;\r\n}\r\n\r\n.eiGEEq_cardName {\r\n  font-weight: 600;\r\n  font-size: 0.95em;\r\n}\r\n\r\n.eiGEEq_cardCount {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  min-width: 22px;\r\n  height: 22px;\r\n  border-radius: 999px;\r\n  padding: 0 6px;\r\n  font-size: 0.78em;\r\n  font-weight: 600;\r\n  background: color-mix(in srgb, currentColor 8%, transparent);\r\n  opacity: 0.55;\r\n}\r\n\r\n.eiGEEq_cardCount[data-has='true'] {\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 16%, transparent);\r\n  color: var(--im-accent, #4a6cf7);\r\n  opacity: 1;\r\n}\r\n\r\n.eiGEEq_detail {\r\n  display: grid;\r\n  grid-template-columns: minmax(0, 300px) minmax(0, 1fr);\r\n  gap: 20px;\r\n  align-items: start;\r\n}\r\n\r\n@media (max-width: 720px) {\r\n  .eiGEEq_detail {\r\n    grid-template-columns: 1fr;\r\n  }\r\n}\r\n\r\n.eiGEEq_qrPanel {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 10px;\r\n  padding: 18px;\r\n  border-radius: 12px;\r\n  border: 1px dashed color-mix(in srgb, currentColor 18%, transparent);\r\n  min-height: 300px;\r\n  justify-content: center;\r\n}\r\n\r\n.eiGEEq_qrPanel[data-state='confirmed'] {\r\n  border-style: solid;\r\n  border-color: #27ae60;\r\n}\r\n\r\n.eiGEEq_qrPanel[data-state='error'] {\r\n  border-style: solid;\r\n  border-color: #c0392b;\r\n}\r\n\r\n.eiGEEq_qrImage {\r\n  border-radius: 8px;\r\n  background: #fff;\r\n  padding: 6px;\r\n}\r\n\r\n.eiGEEq_qrClickArea {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 8px;\r\n}\r\n\r\n.eiGEEq_qrRefreshButton {\r\n  padding: 0;\r\n  border: none;\r\n  background: transparent;\r\n  cursor: pointer;\r\n  border-radius: 8px;\r\n  line-height: 0;\r\n}\r\n\r\n.eiGEEq_qrRefreshButton:hover .eiGEEq_qrImage,\r\n.eiGEEq_qrRefreshButton:focus-visible .eiGEEq_qrImage {\r\n  opacity: 0.82;\r\n}\r\n\r\n.eiGEEq_qrRefreshHint {\r\n  font-size: 0.82em;\r\n  opacity: 0.55;\r\n}\r\n\r\n.eiGEEq_qrSpinner {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 10px;\r\n  opacity: 0.6;\r\n}\r\n\r\n.eiGEEq_qrSpinnerRing {\r\n  width: 28px;\r\n  height: 28px;\r\n  border-radius: 50%;\r\n  border: 3px solid color-mix(in srgb, currentColor 20%, transparent);\r\n  border-top-color: currentColor;\r\n  animation: qrSpin 0.9s linear infinite;\r\n}\r\n\r\n@keyframes qrSpin {\r\n  to { transform: rotate(360deg); }\r\n}\r\n\r\n.eiGEEq_qrOk {\r\n  color: #27ae60;\r\n  font-weight: 600;\r\n}\r\n\r\n.eiGEEq_qrError {\r\n  color: #c0392b;\r\n}\r\n\r\n.eiGEEq_stepsPanel {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 14px;\r\n}\r\n\r\n.eiGEEq_stepsTitle {\r\n  font-weight: 600;\r\n  margin: 0;\r\n}\r\n\r\n.eiGEEq_steps {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n  padding: 0;\r\n  margin: 0;\r\n  list-style: none;\r\n  counter-reset: step;\r\n}\r\n\r\n.eiGEEq_step {\r\n  display: flex;\r\n  gap: 12px;\r\n  align-items: flex-start;\r\n  counter-increment: step;\r\n}\r\n\r\n.eiGEEq_stepNumber {\r\n  flex: none;\r\n  display: grid;\r\n  place-items: center;\r\n  width: 24px;\r\n  height: 24px;\r\n  border-radius: 50%;\r\n  font-size: 0.78em;\r\n  font-weight: 600;\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 16%, transparent);\r\n  color: var(--im-accent, #4a6cf7);\r\n}\r\n\r\n.eiGEEq_stepNumber::before {\r\n  content: counter(step);\r\n}\r\n\r\n.eiGEEq_stepBody {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 3px;\r\n  font-size: 0.92em;\r\n}\r\n\r\n.eiGEEq_stepText {\r\n  opacity: 0.9;\r\n}\r\n\r\n.eiGEEq_stepNote {\r\n  font-size: 0.82em;\r\n  opacity: 0.55;\r\n}\r\n\r\n.eiGEEq_bindings {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 10px;\r\n}\r\n\r\n.eiGEEq_bindingsTitle {\r\n  margin: 0;\r\n  font-weight: 600;\r\n}\r\n\r\n.eiGEEq_bindingsEmpty {\r\n  margin: 0;\r\n  opacity: 0.55;\r\n  font-size: 0.9em;\r\n}\r\n\r\n.eiGEEq_bindingsTable {\r\n  border-collapse: collapse;\r\n  font-size: 0.88em;\r\n}\r\n\r\n.eiGEEq_bindingsTable th {\r\n  text-align: left;\r\n  font-weight: 600;\r\n  opacity: 0.6;\r\n  padding: 6px 18px 6px 0;\r\n  border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);\r\n}\r\n\r\n.eiGEEq_bindingsTable td {\r\n  padding: 8px 18px 8px 0;\r\n  border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);\r\n}\r\n\r\n.eiGEEq_bindingKind {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  padding: 2px 10px;\r\n  border-radius: 999px;\r\n  font-size: 0.9em;\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 12%, transparent);\r\n  color: var(--im-accent, #4a6cf7);\r\n}\r\n\r\n.eiGEEq_bindingSession {\r\n  font-family: ui-monospace, monospace;\r\n  font-size: 0.85em;\r\n  opacity: 0.7;\r\n  max-width: 220px;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.eiGEEq_bindingRemove {\r\n  padding: 4px 12px;\r\n  border-radius: 6px;\r\n  border: 1px solid color-mix(in srgb, #c0392b 40%, transparent);\r\n  color: #c0392b;\r\n  background: transparent;\r\n  font-size: 0.82em;\r\n  cursor: pointer;\r\n  transition: background 0.15s ease;\r\n}\r\n\r\n.eiGEEq_bindingRemove:hover {\r\n  background: color-mix(in srgb, #c0392b 8%, transparent);\r\n}\r\n\r\n.eiGEEq_passphraseCard {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 12px;\r\n  padding: 14px 18px;\r\n  border-radius: 12px;\r\n  border: 1px solid color-mix(in srgb, var(--im-accent, #4a6cf7) 30%, transparent);\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 6%, transparent);\r\n}\r\n\r\n.eiGEEq_passphraseTitle {\r\n  font-weight: 600;\r\n}\r\n\r\n.eiGEEq_passphraseHint {\r\n  font-size: 0.88em;\r\n  opacity: 0.75;\r\n}\r\n\r\n.eiGEEq_passphraseCommand {\r\n  font-family: ui-monospace, Consolas, monospace;\r\n  font-size: 0.95em;\r\n  font-weight: 600;\r\n  padding: 6px 14px;\r\n  border-radius: 8px;\r\n  background: color-mix(in srgb, var(--im-accent, #4a6cf7) 12%, transparent);\r\n  color: var(--im-accent, #4a6cf7);\r\n  cursor: pointer;\r\n  user-select: all;\r\n}\r\n";
var tagIds = ["@dsh-extra/dsh-client-ui-settings-im/BotChannelTab.module.module.css"];
if (typeof document !== "undefined") {
  for (const tagId of tagIds) {
    if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@dsh-extra/dsh-client-ui-settings-im";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }
  }
}
var BotChannelTab_default = { "section": "eiGEEq_section", "intro": "eiGEEq_intro", "cards": "eiGEEq_cards", "card": "eiGEEq_card", "cardIcon": "eiGEEq_cardIcon", "cardName": "eiGEEq_cardName", "cardCount": "eiGEEq_cardCount", "detail": "eiGEEq_detail", "qrPanel": "eiGEEq_qrPanel", "qrImage": "eiGEEq_qrImage", "qrClickArea": "eiGEEq_qrClickArea", "qrRefreshButton": "eiGEEq_qrRefreshButton", "qrRefreshHint": "eiGEEq_qrRefreshHint", "qrSpinner": "eiGEEq_qrSpinner", "qrSpinnerRing": "eiGEEq_qrSpinnerRing", "qrOk": "eiGEEq_qrOk", "qrError": "eiGEEq_qrError", "stepsPanel": "eiGEEq_stepsPanel", "stepsTitle": "eiGEEq_stepsTitle", "steps": "eiGEEq_steps", "step": "eiGEEq_step", "stepNumber": "eiGEEq_stepNumber", "stepBody": "eiGEEq_stepBody", "stepText": "eiGEEq_stepText", "stepNote": "eiGEEq_stepNote", "bindings": "eiGEEq_bindings", "bindingsTitle": "eiGEEq_bindingsTitle", "bindingsEmpty": "eiGEEq_bindingsEmpty", "bindingsTable": "eiGEEq_bindingsTable", "bindingKind": "eiGEEq_bindingKind", "bindingSession": "eiGEEq_bindingSession", "bindingRemove": "eiGEEq_bindingRemove", "passphraseCard": "eiGEEq_passphraseCard", "passphraseTitle": "eiGEEq_passphraseTitle", "passphraseHint": "eiGEEq_passphraseHint", "passphraseCommand": "eiGEEq_passphraseCommand" };

// node_modules/.pnpm/qrcode-generator@2.0.4/node_modules/qrcode-generator/dist/qrcode.mjs
var qrcode = function(typeNumber, errorCorrectionLevel) {
  const PAD0 = 236;
  const PAD1 = 17;
  let _typeNumber = typeNumber;
  const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  let _modules = null;
  let _moduleCount = 0;
  let _dataCache = null;
  const _dataList = [];
  const _this = {};
  const makeImpl = function(test, maskPattern) {
    _moduleCount = _typeNumber * 4 + 17;
    _modules = function(moduleCount) {
      const modules = new Array(moduleCount);
      for (let row = 0; row < moduleCount; row += 1) {
        modules[row] = new Array(moduleCount);
        for (let col = 0; col < moduleCount; col += 1) {
          modules[row][col] = null;
        }
      }
      return modules;
    }(_moduleCount);
    setupPositionProbePattern(0, 0);
    setupPositionProbePattern(_moduleCount - 7, 0);
    setupPositionProbePattern(0, _moduleCount - 7);
    setupPositionAdjustPattern();
    setupTimingPattern();
    setupTypeInfo(test, maskPattern);
    if (_typeNumber >= 7) {
      setupTypeNumber(test);
    }
    if (_dataCache == null) {
      _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
    }
    mapData(_dataCache, maskPattern);
  };
  const setupPositionProbePattern = function(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      if (row + r <= -1 || _moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c += 1) {
        if (col + c <= -1 || _moduleCount <= col + c) continue;
        if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
          _modules[row + r][col + c] = true;
        } else {
          _modules[row + r][col + c] = false;
        }
      }
    }
  };
  const getBestMaskPattern = function() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i += 1) {
      makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(_this);
      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  };
  const setupTimingPattern = function() {
    for (let r = 8; r < _moduleCount - 8; r += 1) {
      if (_modules[r][6] != null) {
        continue;
      }
      _modules[r][6] = r % 2 == 0;
    }
    for (let c = 8; c < _moduleCount - 8; c += 1) {
      if (_modules[6][c] != null) {
        continue;
      }
      _modules[6][c] = c % 2 == 0;
    }
  };
  const setupPositionAdjustPattern = function() {
    const pos = QRUtil.getPatternPosition(_typeNumber);
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = 0; j < pos.length; j += 1) {
        const row = pos[i];
        const col = pos[j];
        if (_modules[row][col] != null) {
          continue;
        }
        for (let r = -2; r <= 2; r += 1) {
          for (let c = -2; c <= 2; c += 1) {
            if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  };
  const setupTypeNumber = function(test) {
    const bits = QRUtil.getBCHTypeNumber(_typeNumber);
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  };
  const setupTypeInfo = function(test, maskPattern) {
    const data = _errorCorrectionLevel << 3 | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 6) {
        _modules[i][8] = mod;
      } else if (i < 8) {
        _modules[i + 1][8] = mod;
      } else {
        _modules[_moduleCount - 15 + i][8] = mod;
      }
    }
    for (let i = 0; i < 15; i += 1) {
      const mod = !test && (bits >> i & 1) == 1;
      if (i < 8) {
        _modules[8][_moduleCount - i - 1] = mod;
      } else if (i < 9) {
        _modules[8][15 - i - 1 + 1] = mod;
      } else {
        _modules[8][15 - i - 1] = mod;
      }
    }
    _modules[_moduleCount - 8][8] = !test;
  };
  const mapData = function(data, maskPattern) {
    let inc = -1;
    let row = _moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFunc = QRUtil.getMaskFunction(maskPattern);
    for (let col = _moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col -= 1;
      while (true) {
        for (let c = 0; c < 2; c += 1) {
          if (_modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = (data[byteIndex] >>> bitIndex & 1) == 1;
            }
            const mask = maskFunc(row, col - c);
            if (mask) {
              dark = !dark;
            }
            _modules[row][col - c] = dark;
            bitIndex -= 1;
            if (bitIndex == -1) {
              byteIndex += 1;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || _moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  };
  const createBytes = function(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r += 1) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i += 1) {
        dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
      }
      offset += dcCount;
      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i += 1) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
      }
    }
    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalCodeCount += rsBlocks[i].totalCount;
    }
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < dcdata[r].length) {
          data[index] = dcdata[r][i];
          index += 1;
        }
      }
    }
    for (let i = 0; i < maxEcCount; i += 1) {
      for (let r = 0; r < rsBlocks.length; r += 1) {
        if (i < ecdata[r].length) {
          data[index] = ecdata[r][i];
          index += 1;
        }
      }
    }
    return data;
  };
  const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
    const buffer = qrBitBuffer();
    for (let i = 0; i < dataList.length; i += 1) {
      const data = dataList[i];
      buffer.put(data.getMode(), 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
      data.write(buffer);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i += 1) {
      totalDataCount += rsBlocks[i].dataCount;
    }
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.getLengthInBits() % 8 != 0) {
      buffer.putBit(false);
    }
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) {
        break;
      }
      buffer.put(PAD1, 8);
    }
    return createBytes(buffer, rsBlocks);
  };
  _this.addData = function(data, mode) {
    mode = mode || "Byte";
    let newData = null;
    switch (mode) {
      case "Numeric":
        newData = qrNumber(data);
        break;
      case "Alphanumeric":
        newData = qrAlphaNum(data);
        break;
      case "Byte":
        newData = qr8BitByte(data);
        break;
      case "Kanji":
        newData = qrKanji(data);
        break;
      default:
        throw "mode:" + mode;
    }
    _dataList.push(newData);
    _dataCache = null;
  };
  _this.isDark = function(row, col) {
    if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
      throw row + "," + col;
    }
    return _modules[row][col];
  };
  _this.getModuleCount = function() {
    return _moduleCount;
  };
  _this.make = function() {
    if (_typeNumber < 1) {
      let typeNumber2 = 1;
      for (; typeNumber2 < 40; typeNumber2++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
        const buffer = qrBitBuffer();
        for (let i = 0; i < _dataList.length; i++) {
          const data = _dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
          data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount;
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) {
          break;
        }
      }
      _typeNumber = typeNumber2;
    }
    makeImpl(false, getBestMaskPattern());
  };
  _this.createTableTag = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    let qrHtml = "";
    qrHtml += '<table style="';
    qrHtml += " border-width: 0px; border-style: none;";
    qrHtml += " border-collapse: collapse;";
    qrHtml += " padding: 0px; margin: " + margin + "px;";
    qrHtml += '">';
    qrHtml += "<tbody>";
    for (let r = 0; r < _this.getModuleCount(); r += 1) {
      qrHtml += "<tr>";
      for (let c = 0; c < _this.getModuleCount(); c += 1) {
        qrHtml += '<td style="';
        qrHtml += " border-width: 0px; border-style: none;";
        qrHtml += " border-collapse: collapse;";
        qrHtml += " padding: 0px; margin: 0px;";
        qrHtml += " width: " + cellSize + "px;";
        qrHtml += " height: " + cellSize + "px;";
        qrHtml += " background-color: ";
        qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
        qrHtml += ";";
        qrHtml += '"/>';
      }
      qrHtml += "</tr>";
    }
    qrHtml += "</tbody>";
    qrHtml += "</table>";
    return qrHtml;
  };
  _this.createSvgTag = function(cellSize, margin, alt, title) {
    let opts = {};
    if (typeof arguments[0] == "object") {
      opts = arguments[0];
      cellSize = opts.cellSize;
      margin = opts.margin;
      alt = opts.alt;
      title = opts.title;
    }
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    alt = typeof alt === "string" ? { text: alt } : alt || {};
    alt.text = alt.text || null;
    alt.id = alt.text ? alt.id || "qrcode-description" : null;
    title = typeof title === "string" ? { text: title } : title || {};
    title.text = title.text || null;
    title.id = title.text ? title.id || "qrcode-title" : null;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let c, mc, r, mr, qrSvg = "", rect;
    rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
    qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
    qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
    qrSvg += ' viewBox="0 0 ' + size + " " + size + '" ';
    qrSvg += ' preserveAspectRatio="xMinYMin meet"';
    qrSvg += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
    qrSvg += ">";
    qrSvg += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
    qrSvg += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
    qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
    qrSvg += '<path d="';
    for (r = 0; r < _this.getModuleCount(); r += 1) {
      mr = r * cellSize + margin;
      for (c = 0; c < _this.getModuleCount(); c += 1) {
        if (_this.isDark(r, c)) {
          mc = c * cellSize + margin;
          qrSvg += "M" + mc + "," + mr + rect;
        }
      }
    }
    qrSvg += '" stroke="transparent" fill="black"/>';
    qrSvg += "</svg>";
    return qrSvg;
  };
  _this.createDataURL = function(cellSize, margin) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    return createDataURL(size, size, function(x, y) {
      if (min <= x && x < max && min <= y && y < max) {
        const c = Math.floor((x - min) / cellSize);
        const r = Math.floor((y - min) / cellSize);
        return _this.isDark(r, c) ? 0 : 1;
      } else {
        return 1;
      }
    });
  };
  _this.createImgTag = function(cellSize, margin, alt) {
    cellSize = cellSize || 2;
    margin = typeof margin == "undefined" ? cellSize * 4 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    let img = "";
    img += "<img";
    img += ' src="';
    img += _this.createDataURL(cellSize, margin);
    img += '"';
    img += ' width="';
    img += size;
    img += '"';
    img += ' height="';
    img += size;
    img += '"';
    if (alt) {
      img += ' alt="';
      img += escapeXml(alt);
      img += '"';
    }
    img += "/>";
    return img;
  };
  const escapeXml = function(s) {
    let escaped = "";
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charAt(i);
      switch (c) {
        case "<":
          escaped += "&lt;";
          break;
        case ">":
          escaped += "&gt;";
          break;
        case "&":
          escaped += "&amp;";
          break;
        case '"':
          escaped += "&quot;";
          break;
        default:
          escaped += c;
          break;
      }
    }
    return escaped;
  };
  const _createHalfASCII = function(margin) {
    const cellSize = 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r1, r2, p;
    const blocks = {
      "\u2588\u2588": "\u2588",
      "\u2588 ": "\u2580",
      " \u2588": "\u2584",
      "  ": " "
    };
    const blocksLastLineNoMargin = {
      "\u2588\u2588": "\u2580",
      "\u2588 ": "\u2580",
      " \u2588": " ",
      "  ": " "
    };
    let ascii = "";
    for (y = 0; y < size; y += 2) {
      r1 = Math.floor((y - min) / cellSize);
      r2 = Math.floor((y + 1 - min) / cellSize);
      for (x = 0; x < size; x += 1) {
        p = "\u2588";
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
          p = " ";
        }
        if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
          p += " ";
        } else {
          p += "\u2588";
        }
        ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
      }
      ascii += "\n";
    }
    if (size % 2 && margin > 0) {
      return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("\u2580");
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.createASCII = function(cellSize, margin) {
    cellSize = cellSize || 1;
    if (cellSize < 2) {
      return _createHalfASCII(margin);
    }
    cellSize -= 1;
    margin = typeof margin == "undefined" ? cellSize * 2 : margin;
    const size = _this.getModuleCount() * cellSize + margin * 2;
    const min = margin;
    const max = size - margin;
    let y, x, r, p;
    const white = Array(cellSize + 1).join("\u2588\u2588");
    const black = Array(cellSize + 1).join("  ");
    let ascii = "";
    let line = "";
    for (y = 0; y < size; y += 1) {
      r = Math.floor((y - min) / cellSize);
      line = "";
      for (x = 0; x < size; x += 1) {
        p = 1;
        if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
          p = 0;
        }
        line += p ? white : black;
      }
      for (r = 0; r < cellSize; r += 1) {
        ascii += line + "\n";
      }
    }
    return ascii.substring(0, ascii.length - 1);
  };
  _this.renderTo2dContext = function(context, cellSize) {
    cellSize = cellSize || 2;
    const length = _this.getModuleCount();
    for (let row = 0; row < length; row++) {
      for (let col = 0; col < length; col++) {
        context.fillStyle = _this.isDark(row, col) ? "black" : "white";
        context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  };
  return _this;
};
qrcode.stringToBytes = function(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    bytes.push(c & 255);
  }
  return bytes;
};
qrcode.createStringToBytes = function(unicodeData, numChars) {
  const unicodeMap = function() {
    const bin = base64DecodeInputStream(unicodeData);
    const read = function() {
      const b = bin.read();
      if (b == -1) throw "eof";
      return b;
    };
    let count = 0;
    const unicodeMap2 = {};
    while (true) {
      const b0 = bin.read();
      if (b0 == -1) break;
      const b1 = read();
      const b2 = read();
      const b3 = read();
      const k = String.fromCharCode(b0 << 8 | b1);
      const v = b2 << 8 | b3;
      unicodeMap2[k] = v;
      count += 1;
    }
    if (count != numChars) {
      throw count + " != " + numChars;
    }
    return unicodeMap2;
  }();
  const unknownChar = "?".charCodeAt(0);
  return function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      if (c < 128) {
        bytes.push(c);
      } else {
        const b = unicodeMap[s.charAt(i)];
        if (typeof b == "number") {
          if ((b & 255) == b) {
            bytes.push(b);
          } else {
            bytes.push(b >>> 8);
            bytes.push(b & 255);
          }
        } else {
          bytes.push(unknownChar);
        }
      }
    }
    return bytes;
  };
};
var QRMode = {
  MODE_NUMBER: 1 << 0,
  MODE_ALPHA_NUM: 1 << 1,
  MODE_8BIT_BYTE: 1 << 2,
  MODE_KANJI: 1 << 3
};
var QRErrorCorrectionLevel = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
};
var QRMaskPattern = {
  PATTERN000: 0,
  PATTERN001: 1,
  PATTERN010: 2,
  PATTERN011: 3,
  PATTERN100: 4,
  PATTERN101: 5,
  PATTERN110: 6,
  PATTERN111: 7
};
var QRUtil = function() {
  const PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170]
  ];
  const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
  const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
  const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
  const _this = {};
  const getBCHDigit = function(data) {
    let digit = 0;
    while (data != 0) {
      digit += 1;
      data >>>= 1;
    }
    return digit;
  };
  _this.getBCHTypeInfo = function(data) {
    let d = data << 10;
    while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
      d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
    }
    return (data << 10 | d) ^ G15_MASK;
  };
  _this.getBCHTypeNumber = function(data) {
    let d = data << 12;
    while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
      d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
    }
    return data << 12 | d;
  };
  _this.getPatternPosition = function(typeNumber) {
    return PATTERN_POSITION_TABLE[typeNumber - 1];
  };
  _this.getMaskFunction = function(maskPattern) {
    switch (maskPattern) {
      case QRMaskPattern.PATTERN000:
        return function(i, j) {
          return (i + j) % 2 == 0;
        };
      case QRMaskPattern.PATTERN001:
        return function(i, j) {
          return i % 2 == 0;
        };
      case QRMaskPattern.PATTERN010:
        return function(i, j) {
          return j % 3 == 0;
        };
      case QRMaskPattern.PATTERN011:
        return function(i, j) {
          return (i + j) % 3 == 0;
        };
      case QRMaskPattern.PATTERN100:
        return function(i, j) {
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        };
      case QRMaskPattern.PATTERN101:
        return function(i, j) {
          return i * j % 2 + i * j % 3 == 0;
        };
      case QRMaskPattern.PATTERN110:
        return function(i, j) {
          return (i * j % 2 + i * j % 3) % 2 == 0;
        };
      case QRMaskPattern.PATTERN111:
        return function(i, j) {
          return (i * j % 3 + (i + j) % 2) % 2 == 0;
        };
      default:
        throw "bad maskPattern:" + maskPattern;
    }
  };
  _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
    let a = qrPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i += 1) {
      a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  };
  _this.getLengthInBits = function(mode, type) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 10;
        case QRMode.MODE_ALPHA_NUM:
          return 9;
        case QRMode.MODE_8BIT_BYTE:
          return 8;
        case QRMode.MODE_KANJI:
          return 8;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 27) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 12;
        case QRMode.MODE_ALPHA_NUM:
          return 11;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 10;
        default:
          throw "mode:" + mode;
      }
    } else if (type < 41) {
      switch (mode) {
        case QRMode.MODE_NUMBER:
          return 14;
        case QRMode.MODE_ALPHA_NUM:
          return 13;
        case QRMode.MODE_8BIT_BYTE:
          return 16;
        case QRMode.MODE_KANJI:
          return 12;
        default:
          throw "mode:" + mode;
      }
    } else {
      throw "type:" + type;
    }
  };
  _this.getLostPoint = function(qrcode2) {
    const moduleCount = qrcode2.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        let sameCount = 0;
        const dark = qrcode2.isDark(row, col);
        for (let r = -1; r <= 1; r += 1) {
          if (row + r < 0 || moduleCount <= row + r) {
            continue;
          }
          for (let c = -1; c <= 1; c += 1) {
            if (col + c < 0 || moduleCount <= col + c) {
              continue;
            }
            if (r == 0 && c == 0) {
              continue;
            }
            if (dark == qrcode2.isDark(row + r, col + c)) {
              sameCount += 1;
            }
          }
        }
        if (sameCount > 5) {
          lostPoint += 3 + sameCount - 5;
        }
      }
    }
    ;
    for (let row = 0; row < moduleCount - 1; row += 1) {
      for (let col = 0; col < moduleCount - 1; col += 1) {
        let count = 0;
        if (qrcode2.isDark(row, col)) count += 1;
        if (qrcode2.isDark(row + 1, col)) count += 1;
        if (qrcode2.isDark(row, col + 1)) count += 1;
        if (qrcode2.isDark(row + 1, col + 1)) count += 1;
        if (count == 0 || count == 4) {
          lostPoint += 3;
        }
      }
    }
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount - 6; col += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
          lostPoint += 40;
        }
      }
    }
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount - 6; row += 1) {
        if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
          lostPoint += 40;
        }
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col += 1) {
      for (let row = 0; row < moduleCount; row += 1) {
        if (qrcode2.isDark(row, col)) {
          darkCount += 1;
        }
      }
    }
    const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  };
  return _this;
}();
var QRMath = function() {
  const EXP_TABLE = new Array(256);
  const LOG_TABLE = new Array(256);
  for (let i = 0; i < 8; i += 1) {
    EXP_TABLE[i] = 1 << i;
  }
  for (let i = 8; i < 256; i += 1) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i += 1) {
    LOG_TABLE[EXP_TABLE[i]] = i;
  }
  const _this = {};
  _this.glog = function(n) {
    if (n < 1) {
      throw "glog(" + n + ")";
    }
    return LOG_TABLE[n];
  };
  _this.gexp = function(n) {
    while (n < 0) {
      n += 255;
    }
    while (n >= 256) {
      n -= 255;
    }
    return EXP_TABLE[n];
  };
  return _this;
}();
var qrPolynomial = function(num, shift) {
  if (typeof num.length == "undefined") {
    throw num.length + "/" + shift;
  }
  const _num = function() {
    let offset = 0;
    while (offset < num.length && num[offset] == 0) {
      offset += 1;
    }
    const _num2 = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i += 1) {
      _num2[i] = num[i + offset];
    }
    return _num2;
  }();
  const _this = {};
  _this.getAt = function(index) {
    return _num[index];
  };
  _this.getLength = function() {
    return _num.length;
  };
  _this.multiply = function(e) {
    const num2 = new Array(_this.getLength() + e.getLength() - 1);
    for (let i = 0; i < _this.getLength(); i += 1) {
      for (let j = 0; j < e.getLength(); j += 1) {
        num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
      }
    }
    return qrPolynomial(num2, 0);
  };
  _this.mod = function(e) {
    if (_this.getLength() - e.getLength() < 0) {
      return _this;
    }
    const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
    const num2 = new Array(_this.getLength());
    for (let i = 0; i < _this.getLength(); i += 1) {
      num2[i] = _this.getAt(i);
    }
    for (let i = 0; i < e.getLength(); i += 1) {
      num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
    }
    return qrPolynomial(num2, 0).mod(e);
  };
  return _this;
};
var QRRSBlock = function() {
  const RS_BLOCK_TABLE = [
    // L
    // M
    // Q
    // H
    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12, 7, 37, 13],
    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],
    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],
    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],
    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],
    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],
    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],
    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],
    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],
    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],
    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],
    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],
    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],
    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],
    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],
    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],
    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],
    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],
    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],
    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],
    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],
    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],
    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],
    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],
    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],
    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
  ];
  const qrRSBlock = function(totalCount, dataCount) {
    const _this2 = {};
    _this2.totalCount = totalCount;
    _this2.dataCount = dataCount;
    return _this2;
  };
  const _this = {};
  const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H:
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default:
        return void 0;
    }
  };
  _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
    const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (typeof rsBlock == "undefined") {
      throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
    }
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i += 1) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j += 1) {
        list.push(qrRSBlock(totalCount, dataCount));
      }
    }
    return list;
  };
  return _this;
}();
var qrBitBuffer = function() {
  const _buffer = [];
  let _length = 0;
  const _this = {};
  _this.getBuffer = function() {
    return _buffer;
  };
  _this.getAt = function(index) {
    const bufIndex = Math.floor(index / 8);
    return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
  };
  _this.put = function(num, length) {
    for (let i = 0; i < length; i += 1) {
      _this.putBit((num >>> length - i - 1 & 1) == 1);
    }
  };
  _this.getLengthInBits = function() {
    return _length;
  };
  _this.putBit = function(bit) {
    const bufIndex = Math.floor(_length / 8);
    if (_buffer.length <= bufIndex) {
      _buffer.push(0);
    }
    if (bit) {
      _buffer[bufIndex] |= 128 >>> _length % 8;
    }
    _length += 1;
  };
  return _this;
};
var qrNumber = function(data) {
  const _mode = QRMode.MODE_NUMBER;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const data2 = _data;
    let i = 0;
    while (i + 2 < data2.length) {
      buffer.put(strToNum(data2.substring(i, i + 3)), 10);
      i += 3;
    }
    if (i < data2.length) {
      if (data2.length - i == 1) {
        buffer.put(strToNum(data2.substring(i, i + 1)), 4);
      } else if (data2.length - i == 2) {
        buffer.put(strToNum(data2.substring(i, i + 2)), 7);
      }
    }
  };
  const strToNum = function(s) {
    let num = 0;
    for (let i = 0; i < s.length; i += 1) {
      num = num * 10 + chatToNum(s.charAt(i));
    }
    return num;
  };
  const chatToNum = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    }
    throw "illegal char :" + c;
  };
  return _this;
};
var qrAlphaNum = function(data) {
  const _mode = QRMode.MODE_ALPHA_NUM;
  const _data = data;
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _data.length;
  };
  _this.write = function(buffer) {
    const s = _data;
    let i = 0;
    while (i + 1 < s.length) {
      buffer.put(
        getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
        11
      );
      i += 2;
    }
    if (i < s.length) {
      buffer.put(getCode(s.charAt(i)), 6);
    }
  };
  const getCode = function(c) {
    if ("0" <= c && c <= "9") {
      return c.charCodeAt(0) - "0".charCodeAt(0);
    } else if ("A" <= c && c <= "Z") {
      return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
    } else {
      switch (c) {
        case " ":
          return 36;
        case "$":
          return 37;
        case "%":
          return 38;
        case "*":
          return 39;
        case "+":
          return 40;
        case "-":
          return 41;
        case ".":
          return 42;
        case "/":
          return 43;
        case ":":
          return 44;
        default:
          throw "illegal char :" + c;
      }
    }
  };
  return _this;
};
var qr8BitByte = function(data) {
  const _mode = QRMode.MODE_8BIT_BYTE;
  const _data = data;
  const _bytes = qrcode.stringToBytes(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return _bytes.length;
  };
  _this.write = function(buffer) {
    for (let i = 0; i < _bytes.length; i += 1) {
      buffer.put(_bytes[i], 8);
    }
  };
  return _this;
};
var qrKanji = function(data) {
  const _mode = QRMode.MODE_KANJI;
  const _data = data;
  const stringToBytes2 = qrcode.stringToBytes;
  !function(c, code) {
    const test = stringToBytes2(c);
    if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
      throw "sjis not supported.";
    }
  }("\u53CB", 38726);
  const _bytes = stringToBytes2(data);
  const _this = {};
  _this.getMode = function() {
    return _mode;
  };
  _this.getLength = function(buffer) {
    return ~~(_bytes.length / 2);
  };
  _this.write = function(buffer) {
    const data2 = _bytes;
    let i = 0;
    while (i + 1 < data2.length) {
      let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
      if (33088 <= c && c <= 40956) {
        c -= 33088;
      } else if (57408 <= c && c <= 60351) {
        c -= 49472;
      } else {
        throw "illegal char at " + (i + 1) + "/" + c;
      }
      c = (c >>> 8 & 255) * 192 + (c & 255);
      buffer.put(c, 13);
      i += 2;
    }
    if (i < data2.length) {
      throw "illegal char at " + (i + 1);
    }
  };
  return _this;
};
var byteArrayOutputStream = function() {
  const _bytes = [];
  const _this = {};
  _this.writeByte = function(b) {
    _bytes.push(b & 255);
  };
  _this.writeShort = function(i) {
    _this.writeByte(i);
    _this.writeByte(i >>> 8);
  };
  _this.writeBytes = function(b, off, len) {
    off = off || 0;
    len = len || b.length;
    for (let i = 0; i < len; i += 1) {
      _this.writeByte(b[i + off]);
    }
  };
  _this.writeString = function(s) {
    for (let i = 0; i < s.length; i += 1) {
      _this.writeByte(s.charCodeAt(i));
    }
  };
  _this.toByteArray = function() {
    return _bytes;
  };
  _this.toString = function() {
    let s = "";
    s += "[";
    for (let i = 0; i < _bytes.length; i += 1) {
      if (i > 0) {
        s += ",";
      }
      s += _bytes[i];
    }
    s += "]";
    return s;
  };
  return _this;
};
var base64EncodeOutputStream = function() {
  let _buffer = 0;
  let _buflen = 0;
  let _length = 0;
  let _base64 = "";
  const _this = {};
  const writeEncoded = function(b) {
    _base64 += String.fromCharCode(encode(b & 63));
  };
  const encode = function(n) {
    if (n < 0) {
      throw "n:" + n;
    } else if (n < 26) {
      return 65 + n;
    } else if (n < 52) {
      return 97 + (n - 26);
    } else if (n < 62) {
      return 48 + (n - 52);
    } else if (n == 62) {
      return 43;
    } else if (n == 63) {
      return 47;
    } else {
      throw "n:" + n;
    }
  };
  _this.writeByte = function(n) {
    _buffer = _buffer << 8 | n & 255;
    _buflen += 8;
    _length += 1;
    while (_buflen >= 6) {
      writeEncoded(_buffer >>> _buflen - 6);
      _buflen -= 6;
    }
  };
  _this.flush = function() {
    if (_buflen > 0) {
      writeEncoded(_buffer << 6 - _buflen);
      _buffer = 0;
      _buflen = 0;
    }
    if (_length % 3 != 0) {
      const padlen = 3 - _length % 3;
      for (let i = 0; i < padlen; i += 1) {
        _base64 += "=";
      }
    }
  };
  _this.toString = function() {
    return _base64;
  };
  return _this;
};
var base64DecodeInputStream = function(str) {
  const _str = str;
  let _pos = 0;
  let _buffer = 0;
  let _buflen = 0;
  const _this = {};
  _this.read = function() {
    while (_buflen < 8) {
      if (_pos >= _str.length) {
        if (_buflen == 0) {
          return -1;
        }
        throw "unexpected end of file./" + _buflen;
      }
      const c = _str.charAt(_pos);
      _pos += 1;
      if (c == "=") {
        _buflen = 0;
        return -1;
      } else if (c.match(/^\s$/)) {
        continue;
      }
      _buffer = _buffer << 6 | decode(c.charCodeAt(0));
      _buflen += 6;
    }
    const n = _buffer >>> _buflen - 8 & 255;
    _buflen -= 8;
    return n;
  };
  const decode = function(c) {
    if (65 <= c && c <= 90) {
      return c - 65;
    } else if (97 <= c && c <= 122) {
      return c - 97 + 26;
    } else if (48 <= c && c <= 57) {
      return c - 48 + 52;
    } else if (c == 43) {
      return 62;
    } else if (c == 47) {
      return 63;
    } else {
      throw "c:" + c;
    }
  };
  return _this;
};
var gifImage = function(width, height) {
  const _width = width;
  const _height = height;
  const _data = new Array(width * height);
  const _this = {};
  _this.setPixel = function(x, y, pixel) {
    _data[y * _width + x] = pixel;
  };
  _this.write = function(out) {
    out.writeString("GIF87a");
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(128);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(0);
    out.writeByte(255);
    out.writeByte(255);
    out.writeByte(255);
    out.writeString(",");
    out.writeShort(0);
    out.writeShort(0);
    out.writeShort(_width);
    out.writeShort(_height);
    out.writeByte(0);
    const lzwMinCodeSize = 2;
    const raster = getLZWRaster(lzwMinCodeSize);
    out.writeByte(lzwMinCodeSize);
    let offset = 0;
    while (raster.length - offset > 255) {
      out.writeByte(255);
      out.writeBytes(raster, offset, 255);
      offset += 255;
    }
    out.writeByte(raster.length - offset);
    out.writeBytes(raster, offset, raster.length - offset);
    out.writeByte(0);
    out.writeString(";");
  };
  const bitOutputStream = function(out) {
    const _out = out;
    let _bitLength = 0;
    let _bitBuffer = 0;
    const _this2 = {};
    _this2.write = function(data, length) {
      if (data >>> length != 0) {
        throw "length over";
      }
      while (_bitLength + length >= 8) {
        _out.writeByte(255 & (data << _bitLength | _bitBuffer));
        length -= 8 - _bitLength;
        data >>>= 8 - _bitLength;
        _bitBuffer = 0;
        _bitLength = 0;
      }
      _bitBuffer = data << _bitLength | _bitBuffer;
      _bitLength = _bitLength + length;
    };
    _this2.flush = function() {
      if (_bitLength > 0) {
        _out.writeByte(_bitBuffer);
      }
    };
    return _this2;
  };
  const getLZWRaster = function(lzwMinCodeSize) {
    const clearCode = 1 << lzwMinCodeSize;
    const endCode = (1 << lzwMinCodeSize) + 1;
    let bitLength = lzwMinCodeSize + 1;
    const table = lzwTable();
    for (let i = 0; i < clearCode; i += 1) {
      table.add(String.fromCharCode(i));
    }
    table.add(String.fromCharCode(clearCode));
    table.add(String.fromCharCode(endCode));
    const byteOut = byteArrayOutputStream();
    const bitOut = bitOutputStream(byteOut);
    bitOut.write(clearCode, bitLength);
    let dataIndex = 0;
    let s = String.fromCharCode(_data[dataIndex]);
    dataIndex += 1;
    while (dataIndex < _data.length) {
      const c = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      if (table.contains(s + c)) {
        s = s + c;
      } else {
        bitOut.write(table.indexOf(s), bitLength);
        if (table.size() < 4095) {
          if (table.size() == 1 << bitLength) {
            bitLength += 1;
          }
          table.add(s + c);
        }
        s = c;
      }
    }
    bitOut.write(table.indexOf(s), bitLength);
    bitOut.write(endCode, bitLength);
    bitOut.flush();
    return byteOut.toByteArray();
  };
  const lzwTable = function() {
    const _map = {};
    let _size = 0;
    const _this2 = {};
    _this2.add = function(key) {
      if (_this2.contains(key)) {
        throw "dup key:" + key;
      }
      _map[key] = _size;
      _size += 1;
    };
    _this2.size = function() {
      return _size;
    };
    _this2.indexOf = function(key) {
      return _map[key];
    };
    _this2.contains = function(key) {
      return typeof _map[key] != "undefined";
    };
    return _this2;
  };
  return _this;
};
var createDataURL = function(width, height, getPixel) {
  const gif = gifImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gif.setPixel(x, y, getPixel(x, y));
    }
  }
  const b = byteArrayOutputStream();
  gif.write(b);
  const base64 = base64EncodeOutputStream();
  const bytes = b.toByteArray();
  for (let i = 0; i < bytes.length; i += 1) {
    base64.writeByte(bytes[i]);
  }
  base64.flush();
  return "data:image/gif;base64," + base64;
};
var qrcode_default = qrcode;
var stringToBytes = qrcode.stringToBytes;

// src/client/qr.ts
function qrSvgDataUrl(data, size = 240) {
  const qr = qrcode_default(0, "M");
  qr.addData(data);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  let rects = "";
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(x, y)) rects += `M${x * cell} ${y * cell}h${cell}v${cell}h-${cell}z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${rects}" fill="#000"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// src/client/QrPanel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function QrPanel({ login, startError, t, onRefresh }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: BotChannelTab_default.qrPanel, "data-state": login?.status ?? (startError !== void 0 ? "error" : "pending"), children: [
    startError !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", className: BotChannelTab_default.qrError, children: startError }),
    startError === void 0 && login?.qrUrl === void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: BotChannelTab_default.qrSpinner, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: BotChannelTab_default.qrSpinnerRing }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("qr.waiting") })
    ] }),
    login?.qrUrl !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: BotChannelTab_default.qrClickArea, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          className: BotChannelTab_default.qrRefreshButton,
          onClick: onRefresh,
          "aria-label": t("qr.refresh"),
          title: t("qr.refresh"),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "img",
            {
              className: BotChannelTab_default.qrImage,
              src: qrSvgDataUrl(login.qrUrl),
              alt: t("qr.alt"),
              width: 240,
              height: 240
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: BotChannelTab_default.qrRefreshHint, children: t("qr.refreshHint") })
    ] }),
    login?.status === "confirmed" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: BotChannelTab_default.qrOk, children: t("qr.confirmed") }),
    login?.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", className: BotChannelTab_default.qrError, children: login.error })
  ] });
}

// src/client/StepsPanel.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var STEP_NUMBERS = ["1", "2", "3", "4"];
function StepsPanel({ kind, t }) {
  const stepKeys = STEP_NUMBERS.map((n) => `step.${kind}.${n}`);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: BotChannelTab_default.stepsPanel, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: BotChannelTab_default.stepsTitle, children: t(`steps.title.${kind}`) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: BotChannelTab_default.steps, children: stepKeys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: BotChannelTab_default.step, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: BotChannelTab_default.stepNumber, "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: BotChannelTab_default.stepBody, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: BotChannelTab_default.stepText, children: t(key) }) })
    ] }, key)) }),
    kind === "wechat" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: BotChannelTab_default.stepNote, children: t("note.wechat.verifycode") }),
    kind === "wecom" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: BotChannelTab_default.stepNote, children: t("note.wecom") })
  ] });
}

// src/client/PassphraseCard.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function PassphraseCard({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: BotChannelTab_default.passphraseCard, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: BotChannelTab_default.passphraseTitle, children: t("bind.commandTitle") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: BotChannelTab_default.passphraseHint, children: t("bind.commandHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: BotChannelTab_default.passphraseCommand, children: "/bind" })
  ] });
}

// src/client/WecomConfigPanel.tsx
var import_react = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var formFieldStyle = {
  width: "100%",
  padding: "8px",
  marginBottom: "16px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  boxSizing: "border-box"
};
var submitButtonStyle = {
  padding: "8px 24px",
  backgroundColor: "#2A9D8F",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer"
};
var linkStyle = {
  background: "none",
  border: "none",
  color: "#2A9D8F",
  cursor: "pointer",
  padding: "4px 0",
  textDecoration: "underline",
  fontSize: "13px"
};
function WecomConfigPanel({ onConfigured, onError }) {
  const [qrUrl, setQrUrl] = (0, import_react.useState)(void 0);
  const [polling, setPolling] = (0, import_react.useState)(false);
  const [showManual, setShowManual] = (0, import_react.useState)(false);
  const scodeRef = (0, import_react.useRef)(void 0);
  const timerRef = (0, import_react.useRef)(void 0);
  const stopPolling = (0, import_react.useCallback)(() => {
    if (timerRef.current !== void 0) {
      clearInterval(timerRef.current);
      timerRef.current = void 0;
    }
    setPolling(false);
  }, []);
  const startQr = (0, import_react.useCallback)(async () => {
    stopPolling();
    try {
      const resp = await fetch("/im-channel/wecom/qr/start");
      const data = await resp.json();
      if (!data.ok || data.qrUrl === void 0) {
        onError(`\u626B\u7801\u670D\u52A1\u4E0D\u53EF\u7528\uFF1A${data.error ?? "\u672A\u77E5\u9519\u8BEF"}\u3002\u53EF\u4F7F\u7528\u4E0B\u65B9\u624B\u52A8\u914D\u7F6E\u3002`);
        setShowManual(true);
        return;
      }
      scodeRef.current = data.scode;
      setQrUrl(data.qrUrl);
      setPolling(true);
      const interval = Math.max(2e3, data.pollIntervalMs ?? 3e3);
      timerRef.current = window.setInterval(() => {
        void pollQr();
      }, interval);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }, [stopPolling]);
  const pollQr = (0, import_react.useCallback)(async () => {
    const scode = scodeRef.current;
    if (scode === void 0) return;
    try {
      const resp = await fetch(`/im-channel/wecom/qr/status?scode=${encodeURIComponent(scode)}`);
      const data = await resp.json();
      if (data.ok && data.status === "confirmed") {
        stopPolling();
        onConfigured();
        return;
      }
      if (data.ok && (data.status === "expired" || data.status === "failed")) {
        stopPolling();
        onError("\u626B\u7801\u5DF2\u8FC7\u671F\u6216\u5931\u8D25\uFF0C\u8BF7\u70B9\u51FB\u4E8C\u7EF4\u7801\u91CD\u8BD5\uFF0C\u6216\u4F7F\u7528\u624B\u52A8\u914D\u7F6E\u3002");
      }
    } catch {
    }
  }, [stopPolling, onConfigured]);
  (0, import_react.useEffect)(() => {
    return () => {
      if (timerRef.current !== void 0) clearInterval(timerRef.current);
    };
  }, []);
  const submitBotConfig = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const botId = form.elements.namedItem("botId").value.trim();
    const secret = form.elements.namedItem("secret").value.trim();
    if (!botId || !secret) return;
    try {
      const resp = await fetch("/im-channel/wecom/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, secret })
      });
      const data = await resp.json();
      if (data.ok) {
        onConfigured();
      } else {
        onError(data.error ?? "\u914D\u7F6E\u5931\u8D25");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: BotChannelTab_default.qrPanel, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "16px", width: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: "0 0 12px", fontSize: "13px", color: "#666" }, children: "\u7528\u4F01\u4E1A\u5FAE\u4FE1 App \u626B\u7801\uFF0C\u4E00\u952E\u521B\u5EFA\u667A\u80FD\u673A\u5668\u4EBA\u5E76\u81EA\u52A8\u5B8C\u6210\u914D\u7F6E\u3002" }),
    qrUrl !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { textAlign: "center", marginBottom: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "img",
        {
          src: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`,
          alt: "\u4F01\u4E1A\u5FAE\u4FE1\u626B\u7801\u521B\u5EFA\u673A\u5668\u4EBA",
          style: { width: 240, height: 240, cursor: "pointer" },
          onClick: () => {
            void startQr();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { margin: "6px 0 0", fontSize: "12px", color: polling ? "#2A9D8F" : "#999" }, children: polling ? "\u7B49\u5F85\u626B\u7801\u786E\u8BA4\u2026\uFF08\u70B9\u51FB\u4E8C\u7EF4\u7801\u5237\u65B0\uFF09" : "\u70B9\u51FB\u4E8C\u7EF4\u7801\u91CD\u65B0\u751F\u6210" })
    ] }),
    qrUrl === void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: submitButtonStyle, onClick: () => {
      void startQr();
    }, children: "\u751F\u6210\u626B\u7801\u4E8C\u7EF4\u7801" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", style: { ...linkStyle, display: "block", margin: "8px 0" }, onClick: () => {
      setShowManual((v) => !v);
    }, children: showManual ? "\u6536\u8D77\u624B\u52A8\u914D\u7F6E" : "\u5DF2\u6709\u673A\u5668\u4EBA\uFF1F\u624B\u52A8\u586B\u5199 BotID / Secret" }),
    showManual && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("form", { onSubmit: (e) => {
      void submitBotConfig(e);
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: { display: "block", marginBottom: "8px", fontWeight: "600" }, children: "BotID" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "text", name: "botId", placeholder: "AIBOTID_xxxxxxxx", style: formFieldStyle }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: { display: "block", marginBottom: "8px", fontWeight: "600" }, children: "Secret" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "password", name: "secret", placeholder: "\u8F93\u5165 Secret", style: formFieldStyle }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "submit", style: submitButtonStyle, children: "\u4FDD\u5B58\u914D\u7F6E" })
    ] })
  ] }) });
}

// src/client/McpServersPanel.tsx
var import_react2 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var formFieldStyle2 = {
  width: "100%",
  padding: "8px",
  marginBottom: "12px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  boxSizing: "border-box"
};
var btnStyle = {
  padding: "6px 16px",
  backgroundColor: "#2A9D8F",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "13px"
};
var smallBtn = { ...btnStyle, padding: "4px 10px", fontSize: "12px" };
var dangerBtn = { ...smallBtn, backgroundColor: "#E76F51" };
var ghostBtn = { ...smallBtn, backgroundColor: "#fff", color: "#555", border: "1px solid #ccc" };
var badgeStyle = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "10px",
  fontSize: "11px",
  whiteSpace: "nowrap"
};
function TestBadge({ test }) {
  if (test.state === "idle") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", {});
  if (test.state === "testing") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { ...badgeStyle, backgroundColor: "#F4F4F4", color: "#888" }, children: "\u23F3 \u6D4B\u8BD5\u4E2D\u2026" });
  }
  if (test.state === "ok") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { ...badgeStyle, backgroundColor: "#E4F5F2", color: "#2A9D8F" }, children: [
      "\u2705 ",
      test.toolCount,
      " \u4E2A\u5DE5\u5177"
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { title: test.error, style: { ...badgeStyle, backgroundColor: "#FDEEE8", color: "#E76F51", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis" }, children: [
    "\u274C ",
    test.error
  ] });
}
function McpServersPanel() {
  const [servers, setServers] = (0, import_react2.useState)([]);
  const [status, setStatus] = (0, import_react2.useState)(void 0);
  const [importText, setImportText] = (0, import_react2.useState)("");
  const [candidates, setCandidates] = (0, import_react2.useState)([]);
  const [unsupported, setUnsupported] = (0, import_react2.useState)([]);
  const [invalidLines, setInvalidLines] = (0, import_react2.useState)([]);
  const [parsing, setParsing] = (0, import_react2.useState)(false);
  const [importing, setImporting] = (0, import_react2.useState)(false);
  const [rowTests, setRowTests] = (0, import_react2.useState)({});
  const [editingId, setEditingId] = (0, import_react2.useState)(void 0);
  const [editName, setEditName] = (0, import_react2.useState)("");
  const [editUrl, setEditUrl] = (0, import_react2.useState)("");
  const [confirmDeleteId, setConfirmDeleteId] = (0, import_react2.useState)(void 0);
  const loadServers = (0, import_react2.useCallback)(() => {
    fetch("/im-channel/mcp-servers").then((r) => r.json()).then((data) => {
      if (data.ok) setServers(data.servers);
    }).catch(() => {
    });
  }, []);
  (0, import_react2.useEffect)(loadServers, [loadServers]);
  const runTest = async (url) => {
    try {
      const resp = await fetch("/im-channel/mcp-servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await resp.json();
      if (data.ok && data.result?.ok === true) {
        return { state: "ok", toolCount: data.result.toolCount ?? 0 };
      }
      return { state: "fail", error: data.result?.error ?? data.error ?? "\u6D4B\u8BD5\u5931\u8D25" };
    } catch (err) {
      return { state: "fail", error: err instanceof Error ? err.message : String(err) };
    }
  };
  const parseInput = async (silent, textOverride) => {
    const text = (textOverride ?? importText).trim();
    if (text === "") {
      if (!silent) setStatus({ kind: "error", text: "\u8BF7\u5148\u7C98\u8D34 MCP \u670D\u52A1\u5668\u5730\u5740\u6216\u914D\u7F6E" });
      return;
    }
    setParsing(true);
    try {
      const resp = await fetch("/im-channel/mcp-servers/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await resp.json();
      if (!data.ok) {
        setStatus({ kind: "error", text: data.error ?? "\u89E3\u6790\u5931\u8D25" });
        return;
      }
      const parsed = data.candidates ?? [];
      const bad = data.invalid ?? [];
      const unsup = data.unsupported ?? [];
      if (silent && parsed.length === 0 && bad.length === 0 && unsup.length === 0) return;
      if (parsed.length === 0 && bad.length === 0 && unsup.length === 0) {
        setStatus({ kind: "error", text: "\u6CA1\u6709\u8BC6\u522B\u51FA MCP \u670D\u52A1\u5668\uFF1A\u652F\u6301 http(s) \u5730\u5740\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09\u6216 mcpServers JSON \u914D\u7F6E" });
        return;
      }
      const initial = parsed.map((c) => ({ name: c.name, url: c.url, selected: true, test: { state: "idle" } }));
      setCandidates(initial);
      setUnsupported(unsup);
      setInvalidLines(bad);
      initial.forEach((c, index) => {
        setCandidates((prev) => prev.map((item, i) => i === index ? { ...item, test: { state: "testing" } } : item));
        void runTest(c.url).then((result) => {
          setCandidates((prev) => prev.map((item, i) => i === index ? { ...item, test: result } : item));
        });
      });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setParsing(false);
    }
  };
  const addSelected = async () => {
    const chosen = candidates.filter((c) => c.selected);
    if (chosen.length === 0) return;
    setImporting(true);
    let added = 0;
    let skipped = 0;
    const failures = [];
    for (const c of chosen) {
      try {
        const resp = await fetch("/im-channel/mcp-servers/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name.trim() === "" ? void 0 : c.name.trim(), type: "streamable-http", url: c.url })
        });
        const data = await resp.json();
        if (data.ok) added++;
        else if (data.code === "duplicate") skipped++;
        else failures.push(`${c.name}: ${data.error ?? "\u6DFB\u52A0\u5931\u8D25"}`);
      } catch (err) {
        failures.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setImporting(false);
    if (added > 0 || skipped > 0) {
      setImportText("");
      setCandidates([]);
      setUnsupported([]);
      setInvalidLines([]);
    }
    const parts = [];
    if (added > 0) parts.push(`\u5DF2\u6DFB\u52A0 ${added} \u4E2A`);
    if (skipped > 0) parts.push(`\u8DF3\u8FC7\u91CD\u590D ${skipped} \u4E2A`);
    if (failures.length > 0) parts.push(`\u5931\u8D25 ${failures.length} \u4E2A\uFF08${failures[0]}\uFF09`);
    if (parts.length > 0) setStatus({ kind: failures.length > 0 && added === 0 ? "error" : "ok", text: parts.join("\uFF0C") });
    loadServers();
  };
  const removeServer = async (id) => {
    try {
      const resp = await fetch("/im-channel/mcp-servers/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await resp.json();
      if (data.ok) {
        setStatus({ kind: "ok", text: "\u5DF2\u5220\u9664" });
        setConfirmDeleteId(void 0);
        loadServers();
      }
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };
  const toggleServer = async (server) => {
    try {
      const resp = await fetch("/im-channel/mcp-servers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: server.id, enabled: !server.enabled })
      });
      const data = await resp.json();
      if (data.ok) loadServers();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };
  const testRow = async (server) => {
    setRowTests((prev) => ({ ...prev, [server.id]: { state: "testing" } }));
    const result = await runTest(server.url);
    setRowTests((prev) => ({ ...prev, [server.id]: result }));
  };
  const startEdit = (server) => {
    setEditingId(server.id);
    setEditName(server.name);
    setEditUrl(server.url);
    setConfirmDeleteId(void 0);
  };
  const saveEdit = async () => {
    if (editingId === void 0) return;
    if (editName.trim() === "" || editUrl.trim() === "") {
      setStatus({ kind: "error", text: "\u540D\u79F0\u548C URL \u4E0D\u80FD\u4E3A\u7A7A" });
      return;
    }
    try {
      const resp = await fetch("/im-channel/mcp-servers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName.trim(), url: editUrl.trim() })
      });
      const data = await resp.json();
      if (data.ok) {
        setEditingId(void 0);
        setStatus({ kind: "ok", text: "\u5DF2\u4FDD\u5B58" });
        loadServers();
      } else {
        setStatus({ kind: "error", text: data.error ?? "\u4FDD\u5B58\u5931\u8D25" });
      }
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };
  const selectedCount = candidates.filter((c) => c.selected).length;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: "24px", padding: "16px", borderTop: "1px solid #ddd" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { style: { fontSize: "16px", fontWeight: "600", marginBottom: "12px" }, children: "MCP \u670D\u52A1\u5668\u7BA1\u7406" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: { fontSize: "12px", color: "#888", marginBottom: "12px" }, children: "\u914D\u7F6E MCP \u670D\u52A1\u5668\uFF0C\u4E3A AI \u52A9\u624B\u63D0\u4F9B\u65E5\u7A0B\u3001\u5F85\u529E\u3001\u4F1A\u8BAE\u7B49\u5916\u90E8\u5DE5\u5177\u80FD\u529B\u3002\u76F4\u63A5\u7C98\u8D34\u5730\u5740\u5373\u53EF\u6DFB\u52A0\uFF0C\u4FDD\u5B58\u524D\u81EA\u52A8\u6D4B\u8BD5\u8FDE\u63A5\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { marginBottom: "8px" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "textarea",
      {
        placeholder: '\u7C98\u8D34 MCP \u670D\u52A1\u5668\u5730\u5740\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09\uFF0C\u6216\u6807\u51C6 mcpServers JSON \u914D\u7F6E\uFF0C\u4F8B\u5982\uFF1A\nhttps://mcp.example.com/mcp\n{"mcpServers": { "\u5F85\u529E": { "url": "https://\u2026" } }}',
        value: importText,
        onChange: (e) => setImportText(e.target.value),
        onPaste: (e) => {
          const pasted = e.clipboardData.getData("text");
          if (pasted.trim() !== "") setTimeout(() => {
            void parseInput(true, pasted);
          }, 50);
        },
        style: { ...formFieldStyle2, fontFamily: "inherit", resize: "vertical", minHeight: "64px" }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: btnStyle, disabled: parsing || importText.trim() === "", onClick: () => {
        void parseInput(false);
      }, children: parsing ? "\u89E3\u6790\u4E2D\u2026" : "\u89E3\u6790\u5E76\u9884\u89C8" }),
      importText !== "" && candidates.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => setImportText(""), children: "\u6E05\u7A7A" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: "11px", color: "#aaa" }, children: "\u652F\u6301 Claude Code / Cursor \u7684 mcpServers JSON \u683C\u5F0F\u4E0E\u88F8 URL" })
    ] }),
    candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { border: "1px solid #E5E5E5", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", backgroundColor: "#FAFAFA" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { fontSize: "12px", color: "#666", margin: "4px 0 8px" }, children: [
        "\u8BC6\u522B\u51FA ",
        candidates.length,
        " \u4E2A\u670D\u52A1\u5668\uFF08\u5DF2\u81EA\u52A8\u6D4B\u8BD5\u8FDE\u63A5\uFF0C\u53EF\u4FEE\u6539\u540D\u79F0\uFF09"
      ] }),
      candidates.map((c, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: "13px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            type: "checkbox",
            checked: c.selected,
            "aria-label": `\u9009\u62E9 ${c.name}`,
            onChange: (e) => setCandidates((prev) => prev.map((item, i) => i === index ? { ...item, selected: e.target.checked } : item))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "input",
          {
            value: c.name,
            "aria-label": "\u670D\u52A1\u5668\u540D\u79F0",
            onChange: (e) => setCandidates((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item)),
            style: { flex: "0 0 150px", padding: "4px 8px", border: "1px solid #ddd", borderRadius: "4px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { flex: 1, color: "#666", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: c.url, children: c.url }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TestBadge, { test: c.test })
      ] }, c.url)),
      unsupported.map((u) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: "8px", padding: "6px 0", fontSize: "12px", color: "#B7791F" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
          "\u26A0\uFE0F ",
          u.name,
          "\uFF08",
          u.rawType,
          "\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { flex: 1 }, children: u.reason })
      ] }, u.name)),
      invalidLines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { padding: "4px 0", fontSize: "12px", color: "#E76F51" }, children: [
        "\u2717 \u65E0\u6CD5\u8BC6\u522B\uFF1A",
        line
      ] }, `${i}-${line.slice(0, 20)}`)),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: "8px", marginTop: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: btnStyle, disabled: importing || selectedCount === 0, onClick: () => {
          void addSelected();
        }, children: importing ? "\u6DFB\u52A0\u4E2D\u2026" : `\u6DFB\u52A0\u6240\u9009\uFF08${selectedCount}\uFF09` }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, disabled: importing, onClick: () => {
          setCandidates([]);
          setUnsupported([]);
          setInvalidLines([]);
        }, children: "\u53D6\u6D88" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { fontSize: "13px", fontWeight: "500", color: "#555", marginBottom: "4px" }, children: [
      "\u5DF2\u6709\u670D\u52A1\u5668\uFF08",
      servers.length,
      "\uFF09"
    ] }),
    servers.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: { color: "#999", fontSize: "13px", marginBottom: "12px" }, children: "\u6682\u65E0 MCP \u670D\u52A1\u5668\u2014\u2014\u5728\u4E0A\u65B9\u7C98\u8D34\u4E00\u4E2A MCP \u670D\u52A1\u5668\u5730\u5740\u8BD5\u8BD5" }),
    servers.map((s) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "8px", borderBottom: "1px solid #eee", fontSize: "13px", flexWrap: "wrap" }, children: editingId === s.id ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { value: editName, "aria-label": "\u540D\u79F0", onChange: (e) => setEditName(e.target.value), style: { flex: "0 0 140px", padding: "4px 8px", border: "1px solid #ddd", borderRadius: "4px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { value: editUrl, "aria-label": "URL", onChange: (e) => setEditUrl(e.target.value), style: { flex: 2, minWidth: "200px", padding: "4px 8px", border: "1px solid #ddd", borderRadius: "4px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: smallBtn, onClick: () => {
        void saveEdit();
      }, children: "\u4FDD\u5B58" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => setEditingId(void 0), children: "\u53D6\u6D88" })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "span",
        {
          title: s.enabled ? "\u70B9\u51FB\u505C\u7528" : "\u70B9\u51FB\u542F\u7528",
          style: { cursor: "pointer", fontSize: "16px", userSelect: "none" },
          onClick: () => {
            void toggleServer(s);
          },
          children: s.enabled ? "\u2705" : "\u2B55"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { flex: "0 0 120px", fontWeight: "500" }, children: s.name }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { flex: 1, color: "#666", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.url, children: s.url }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TestBadge, { test: rowTests[s.id] ?? { state: "idle" } }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => {
        void testRow(s);
      }, children: "\u6D4B\u8BD5" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => startEdit(s), children: "\u7F16\u8F91" }),
      confirmDeleteId === s.id ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: dangerBtn, onClick: () => {
          void removeServer(s.id);
        }, children: "\u786E\u8BA4\u5220\u9664" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => setConfirmDeleteId(void 0), children: "\u53D6\u6D88" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { style: ghostBtn, onClick: () => setConfirmDeleteId(s.id), children: "\u5220\u9664" })
    ] }) }, s.id)),
    status !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { role: "alert", style: { color: status.kind === "ok" ? "#2A9D8F" : "#E76F51", fontSize: "12px", marginTop: "8px" }, children: [
      status.kind === "ok" ? "\u2705 " : "",
      status.text
    ] })
  ] });
}

// src/client/GuestPermissionsPanel.tsx
var import_react3 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
var KIND_LABELS = { wechat: "\u5FAE\u4FE1", feishu: "\u98DE\u4E66", wecom: "\u4F01\u4E1A\u5FAE\u4FE1" };
function GuestPermissionsPanel() {
  const [data, setData] = (0, import_react3.useState)(void 0);
  const [tools, setTools] = (0, import_react3.useState)([]);
  const [commands, setCommands] = (0, import_react3.useState)([]);
  const [custom, setCustom] = (0, import_react3.useState)("");
  const [saving, setSaving] = (0, import_react3.useState)(false);
  const [message, setMessage] = (0, import_react3.useState)("");
  const load = (0, import_react3.useCallback)(async () => {
    try {
      const resp = await fetch("/im-channel/guest-permissions");
      const payload = await resp.json();
      if (payload.ok) {
        setData(payload);
        setTools(payload.guestTools);
        setCommands(payload.guestCommands);
      } else {
        setMessage("\u8BFB\u53D6\u8BBF\u5BA2\u6743\u9650\u5931\u8D25");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    void load();
  }, [load]);
  const toggle = (list, value) => list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const catalogPatterns = new Set((data?.toolCatalog ?? []).map((e) => e.pattern));
  const customPatterns = tools.filter((t) => !catalogPatterns.has(t));
  const addCustom = () => {
    const value = custom.trim();
    if (value.length === 0 || tools.includes(value)) return;
    setTools([...tools, value]);
    setCustom("");
  };
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const resp = await fetch("/im-channel/guest-permissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestTools: tools, guestCommands: commands })
      });
      const payload = await resp.json();
      setMessage(payload.ok ? "\u2705 \u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u4E00\u8F6E\u5BF9\u8BDD\u5373\u751F\u6548" : `\u4FDD\u5B58\u5931\u8D25\uFF1A${payload.error ?? "\u672A\u77E5\u9519\u8BEF"}`);
      if (payload.ok) await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  if (data === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: BotChannelTab_default.qrPanel, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { padding: "16px" }, children: message || "\u52A0\u8F7D\u8BBF\u5BA2\u6743\u9650\u2026" }) });
  }
  const ownerLine = Object.entries(data.owners).map(([kind, o]) => `${KIND_LABELS[kind] ?? kind}\uFF1A${o.bound ? `\u5DF2\u8BA4\u9886\uFF08${o.userId}\uFF09` : "\u672A\u8BA4\u9886"}`).join("\u3000\xB7\u3000");
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: BotChannelTab_default.qrPanel, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { padding: "16px", width: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { style: { margin: "0 0 4px" }, children: "\u{1F6E1} \u8BBF\u5BA2\u6743\u9650" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: { margin: "0 0 12px", fontSize: "13px", color: "#666" }, children: "\u6570\u5B57\u5206\u8EAB\u6A21\u5F0F\uFF1A\u53EA\u6709 Owner \u9700\u8981 /bind\uFF0C\u5176\u4ED6\u6240\u6709\u4EBA\u4F5C\u4E3A\u8BBF\u5BA2\u76F4\u63A5\u5BF9\u8BDD\u3002 \u8BBF\u5BA2\u5171\u4EAB Owner \u7684\u4F1A\u8BDD\u4E0A\u4E0B\u6587\uFF0C\u4F46\u53EA\u80FD\u4F7F\u7528\u4E0B\u65B9\u52FE\u9009\u7684\u80FD\u529B\u3002\u4FDD\u5B58\u540E\u4E0B\u4E00\u8F6E\u5BF9\u8BDD\u5373\u751F\u6548\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: { margin: "0 0 12px", fontSize: "13px" }, children: ownerLine }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h4", { style: { margin: "0 0 8px" }, children: "\u8BBF\u5BA2\u53EF\u7528\u547D\u4EE4" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { marginBottom: "16px" }, children: (data.commandCatalog ?? []).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { style: { display: "block", marginBottom: "4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "input",
        {
          type: "checkbox",
          checked: commands.includes(entry.id),
          onChange: () => {
            setCommands(toggle(commands, entry.id));
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { marginLeft: "6px" }, children: entry.label })
    ] }, entry.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h4", { style: { margin: "0 0 8px" }, children: "\u8BBF\u5BA2\u53EF\u7528\u5DE5\u5177" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { marginBottom: "8px" }, children: (data.toolCatalog ?? []).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { style: { display: "block", marginBottom: "4px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "input",
        {
          type: "checkbox",
          checked: tools.includes(entry.pattern),
          onChange: () => {
            setTools(toggle(tools, entry.pattern));
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { marginLeft: "6px" }, children: [
        entry.label,
        entry.risky ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: "#c0392b", marginLeft: "6px" }, children: "\u26A0 \u9AD8\u5371" }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { color: "#999", marginLeft: "6px", fontFamily: "monospace", fontSize: "12px" }, children: entry.pattern })
      ] })
    ] }, entry.pattern)) }),
    customPatterns.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { marginBottom: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontSize: "13px", color: "#666", marginBottom: "4px" }, children: "\u81EA\u5B9A\u4E49\u6761\u76EE\uFF1A" }),
      customPatterns.map((pattern) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { style: { fontFamily: "monospace", fontSize: "12px" }, children: pattern }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", onClick: () => {
          setTools(tools.filter((t) => t !== pattern));
        }, style: { cursor: "pointer" }, children: "\u79FB\u9664" })
      ] }, pattern))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", gap: "8px", marginBottom: "12px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "input",
        {
          type: "text",
          value: custom,
          placeholder: "\u81EA\u5B9A\u4E49\u5DE5\u5177\u540D\u6216\u901A\u914D\uFF08\u5982 mcp__wecom*\uFF09",
          onChange: (e) => {
            setCustom(e.target.value);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          },
          style: { flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", onClick: addCustom, style: { padding: "6px 12px", cursor: "pointer" }, children: "\u6DFB\u52A0" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "button",
      {
        type: "button",
        disabled: saving,
        onClick: () => {
          void save();
        },
        style: { padding: "8px 24px", backgroundColor: "#2A9D8F", color: "#fff", border: "none", borderRadius: "4px", cursor: saving ? "wait" : "pointer" },
        children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u8BBF\u5BA2\u6743\u9650"
      }
    ),
    message !== "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: { margin: "10px 0 0", fontSize: "13px" }, children: message })
  ] }) });
}

// src/client/BindingsTable.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var KIND_LABELS2 = {
  wechat: "\u5FAE\u4FE1",
  feishu: "\u98DE\u4E66",
  wecom: "\u4F01\u4E1A\u5FAE\u4FE1"
};
function BindingsTable({ bindings, t, onRemove, onTest }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: BotChannelTab_default.bindings, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("h3", { className: BotChannelTab_default.bindingsTitle, children: [
      t("bindings.title"),
      "\uFF08",
      bindings.length,
      "\uFF09"
    ] }),
    bindings.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: BotChannelTab_default.bindingsEmpty, children: t("bindings.empty") }),
    bindings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("table", { className: BotChannelTab_default.bindingsTable, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: t("bindings.kind") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: t("bindings.session") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { children: t("bindings.boundAt") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("th", { "aria-hidden": "true" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("tbody", { children: bindings.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: BotChannelTab_default.bindingKind, children: KIND_LABELS2[row.kind] ?? row.kind }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { className: BotChannelTab_default.bindingSession, children: row.sessionId }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("td", { children: row.boundAt.replace("T", " ").slice(0, 19) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("td", { children: [
          onTest !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: BotChannelTab_default.bindingRemove, style: { marginRight: "8px" }, onClick: () => {
            onTest?.(row);
          }, children: "\u6D4B\u8BD5" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", className: BotChannelTab_default.bindingRemove, onClick: () => {
            onRemove(row);
          }, children: t("bindings.remove") })
        ] })
      ] }, `${row.kind}:${row.sessionId}:${index}`)) })
    ] })
  ] });
}

// src/client/BotChannelTab.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var POLL_INTERVAL_MS = 1500;
var BINDINGS_POLL_INTERVAL_MS = 1e4;
var CARD_MARKS = {
  wechat: WechatMark,
  feishu: FeishuMark,
  wecom: WecomMark
};
function BotChannelTab(props) {
  const t = props.t;
  if (t === void 0) return null;
  const [selected, setSelected] = (0, import_react4.useState)(void 0);
  const [login, setLogin] = (0, import_react4.useState)(void 0);
  const [startError, setStartError] = (0, import_react4.useState)(void 0);
  const [bindings, setBindings] = (0, import_react4.useState)([]);
  const [active, setActive] = (0, import_react4.useState)(typeof document === "undefined" || !document.hidden);
  const loginPollTimer = (0, import_react4.useRef)(void 0);
  const bindingsPollTimer = (0, import_react4.useRef)(void 0);
  const refreshBindings = async () => {
    try {
      const response = await fetch("/im-channel/bindings");
      const body = await response.json();
      if (body.ok) {
        setBindings(body.bindings);
      }
    } catch {
    }
  };
  const removeBinding = async (row) => {
    try {
      await fetch("/im-channel/bindings/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: row.sessionId })
      });
      await refreshBindings();
    } catch {
    }
  };
  const startBindingsPolling = () => {
    if (bindingsPollTimer.current !== void 0) return;
    bindingsPollTimer.current = setInterval(() => {
      void refreshBindings();
    }, BINDINGS_POLL_INTERVAL_MS);
  };
  const stopBindingsPolling = () => {
    if (bindingsPollTimer.current === void 0) return;
    clearInterval(bindingsPollTimer.current);
    bindingsPollTimer.current = void 0;
  };
  (0, import_react4.useEffect)(() => {
    void refreshBindings();
    selectCard("wechat");
    startBindingsPolling();
    const onVisibility = () => {
      const visible = !document.hidden;
      setActive(visible);
      if (visible) {
        void refreshBindings();
        startBindingsPolling();
      } else {
        stopBindingsPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopBindingsPolling();
      if (loginPollTimer.current !== void 0) clearInterval(loginPollTimer.current);
    };
  }, []);
  const stopLoginPolling = () => {
    if (loginPollTimer.current === void 0) return;
    clearInterval(loginPollTimer.current);
    loginPollTimer.current = void 0;
  };
  const selectCard = (kind) => {
    stopLoginPolling();
    setSelected(kind);
    setLogin(void 0);
    setStartError(void 0);
    void startLogin(kind);
  };
  const startLogin = async (kind) => {
    try {
      const response = await fetch("/im-channel/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind })
      });
      const body = await response.json();
      if (!body.ok) {
        setStartError(body.error ?? "login start failed");
        return;
      }
      if (body.qrUrl !== void 0) {
        setLogin({ kind, status: "pending", qrUrl: body.qrUrl, error: void 0 });
      }
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error));
      return;
    }
    loginPollTimer.current = setInterval(() => {
      void pollStatus();
    }, POLL_INTERVAL_MS);
  };
  const refreshQr = () => {
    if (selected === void 0) return;
    stopLoginPolling();
    setStartError(void 0);
    setLogin({ kind: selected, status: "pending", qrUrl: void 0, error: void 0 });
    void startLogin(selected);
  };
  const pollStatus = async () => {
    try {
      const response = await fetch("/im-channel/login/status");
      const body = await response.json();
      if (!body.ok || body.session === null) return;
      setLogin(body.session);
      if (body.session.status === "confirmed") {
        stopLoginPolling();
        void refreshBindings();
      }
      if (body.session.status === "error") {
        stopLoginPolling();
      }
    } catch {
    }
  };
  const cards = [
    { kind: "wechat", label: t("card.wechat") },
    { kind: "feishu", label: t("card.feishu") },
    { kind: "wecom", label: t("card.wecom") }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: BotChannelTab_default.section, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: BotChannelTab_default.intro, children: t("intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { role: "radiogroup", "aria-label": t("cards"), className: BotChannelTab_default.cards, children: cards.map(({ kind, label }) => {
      const Mark = CARD_MARKS[kind];
      const kindCount = bindings.filter((b) => b.kind === kind).length;
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": selected === kind,
          "data-selected": selected === kind ? "true" : void 0,
          className: BotChannelTab_default.card,
          onClick: () => selectCard(kind),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: BotChannelTab_default.cardIcon, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Mark, {}) }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: BotChannelTab_default.cardName, children: label }),
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: BotChannelTab_default.cardCount, "data-has": kindCount > 0 ? "true" : void 0, children: kindCount })
          ]
        },
        kind
      );
    }) }),
    selected !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: BotChannelTab_default.detail, children: [
      selected === "wecom" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        WecomConfigPanel,
        {
          t,
          onConfigured: () => setLogin({ kind: "wecom", status: "confirmed", qrUrl: void 0, error: void 0 }),
          onError: (msg) => setStartError(msg)
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(QrPanel, { login, startError, t, onRefresh: refreshQr }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(StepsPanel, { kind: selected, t })
    ] }),
    login?.status === "confirmed" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(PassphraseCard, { t }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      BindingsTable,
      {
        bindings,
        t,
        onRemove: (row) => {
          void removeBinding(row);
        },
        onTest: (row) => {
          void (async () => {
            try {
              const resp = await fetch("/im-channel/test-send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind: row.kind })
              });
              const data = await resp.json();
              setStartError(data.ok ? "" : data.error ?? "\u53D1\u9001\u5931\u8D25");
            } catch (err) {
              setStartError(err instanceof Error ? err.message : String(err));
            }
          })();
        }
      }
    ),
    !active && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: BotChannelTab_default.bindingsEmpty, children: t("bindings.paused") }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(McpServersPanel, {}),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(GuestPermissionsPanel, {})
  ] });
}

// src/client/ImBotsRail.tsx
var import_react5 = require("react");
var import_jsx_runtime10 = require("react/jsx-runtime");
var POLL_MS = 3e4;
var DOT_ONLINE = "#2A9D8F";
var DOT_OFFLINE = "#B7791F";
var DOT_UNBOUND = "#B9B9B9";
function PlatformMark({ kind, size }) {
  if (kind === "wechat") return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(WechatMark, { size });
  if (kind === "feishu") return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FeishuMark, { size });
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(WecomMark, { size });
}
function dotColor(bot) {
  if (bot === void 0) return DOT_UNBOUND;
  if (!bot.configured) return DOT_UNBOUND;
  return bot.online ? DOT_ONLINE : DOT_OFFLINE;
}
function detailsWidthOf(frame) {
  const tracks = frame.style.gridTemplateColumns;
  if (tracks === "") return 0;
  const last = tracks.trim().split(/\s+/).at(-1) ?? "";
  const px = Number.parseFloat(last);
  return Number.isFinite(px) ? Math.max(0, px) : 0;
}
function ImBotsRail({ t }) {
  const [bots, setBots] = (0, import_react5.useState)(void 0);
  const [loadError, setLoadError] = (0, import_react5.useState)(false);
  const [expanded, setExpanded] = (0, import_react5.useState)(false);
  const [detailsWidth, setDetailsWidth] = (0, import_react5.useState)(0);
  const rootRef = (0, import_react5.useRef)(null);
  const refresh = (0, import_react5.useCallback)(async () => {
    try {
      const resp = await fetch("/im-channel/bots/status");
      const data = await resp.json();
      if (data.ok && Array.isArray(data.bots)) {
        setBots(data.bots);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
  }, []);
  (0, import_react5.useEffect)(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  const toggleExpanded = (0, import_react5.useCallback)(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) void refresh();
  }, [expanded, refresh]);
  (0, import_react5.useLayoutEffect)(() => {
    const root = rootRef.current;
    if (root === null) return;
    const frame = root.parentElement?.parentElement ?? null;
    if (frame === null) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      setDetailsWidth((prev) => {
        const next = detailsWidthOf(frame);
        return prev === next ? prev : next;
      });
    };
    const observer = new MutationObserver(() => {
      if (raf === 0) raf = requestAnimationFrame(measure);
    });
    observer.observe(frame, { attributes: true, attributeFilter: ["style"] });
    measure();
    return () => {
      observer.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, []);
  const order = ["wechat", "feishu", "wecom"];
  const byKind = new Map(bots?.map((b) => [b.kind, b]) ?? []);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      ref: rootRef,
      style: {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        right: `${detailsWidth}px`,
        transition: "right var(--ds-transition-duration-slow, 0.3s) var(--ds-ease-in-out, ease-in-out)",
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 8
      },
      children: [
        expanded && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            role: "status",
            style: {
              width: 268,
              borderRadius: 12,
              padding: "12px 14px",
              background: "var(--dsw-alias-bg-base, #fff)",
              border: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
              boxShadow: "0 6px 24px rgba(0, 0, 0, 0.14)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              color: "inherit"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { fontSize: 13, fontWeight: 600 }, children: t("rail.title") }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  "button",
                  {
                    type: "button",
                    "aria-label": t("rail.collapse"),
                    onClick: toggleExpanded,
                    style: { border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 13, padding: "2px 4px" },
                    children: "\u203A"
                  }
                )
              ] }),
              loadError && bots === void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { fontSize: 12, color: DOT_OFFLINE, display: "flex", gap: 8, alignItems: "center" }, children: [
                t("rail.loadError"),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { type: "button", onClick: () => {
                  void refresh();
                }, style: { border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 12, textDecoration: "underline", padding: 0 }, children: t("rail.retry") })
              ] }),
              order.map((kind) => {
                const bot = byKind.get(kind);
                const statusText = bot === void 0 || !bot.configured ? t("rail.unbound") : bot.online ? t("rail.online") : t("rail.offline");
                return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "7px 2px", opacity: bot !== void 0 && bot.configured ? 1 : 0.55 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PlatformMark, { kind, size: 24 }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 13, fontWeight: 500 }, children: bot?.label ?? kind }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 11, opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: bot?.account ?? "\u2014" }),
                    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 11, opacity: 0.75 }, children: bot !== void 0 && bot.configured ? bot.boundUsers > 0 ? `${bot.boundUsers}${t("rail.usersSuffix")}` : t("rail.usersNone") : t("rail.unbound") })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { title: statusText, style: { width: 9, height: 9, borderRadius: "50%", flex: "none", background: dotColor(bot) } }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { fontSize: 11, opacity: 0.75, flex: "none" }, children: statusText })
                ] }, kind);
              })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "button",
          {
            type: "button",
            "aria-expanded": expanded,
            "aria-label": expanded ? t("rail.collapse") : t("rail.expand"),
            title: expanded ? t("rail.collapse") : t("rail.expand"),
            onClick: toggleExpanded,
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "10px 5px",
              border: "none",
              cursor: "pointer",
              borderRadius: "10px 0 0 10px",
              background: "var(--dsw-alias-bg-base, #fff)",
              borderLeft: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
              borderTop: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
              borderBottom: "1px solid color-mix(in srgb, currentColor 18%, transparent)",
              boxShadow: "-3px 3px 14px rgba(0, 0, 0, 0.12)",
              color: "inherit"
            },
            children: [
              order.map((kind) => {
                const bot = byKind.get(kind);
                return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { style: { position: "relative", display: "inline-flex" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PlatformMark, { kind, size: 18 }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      "aria-hidden": true,
                      style: { position: "absolute", right: -3, bottom: -2, width: 8, height: 8, borderRadius: "50%", background: dotColor(bot), boxShadow: "0 0 0 2px var(--dsw-alias-bg-base, #fff)" }
                    }
                  )
                ] }, kind);
              }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { "aria-hidden": true, style: { fontSize: 11, lineHeight: 1 }, children: expanded ? "\u203A" : "\u2039" })
            ]
          }
        )
      ]
    }
  );
}

// src/client/locales.ts
var zh = {
  nav: "\u624B\u673A\u8FDE\u63A5",
  intro: "\u9009\u62E9\u4E00\u4E2A\u5E73\u53F0\uFF0C\u624B\u673A\u626B\u7801\u5373\u53EF\u521B\u5EFA/\u7ED1\u5B9A\u673A\u5668\u4EBA\u5E76\u63A5\u5165 harness\u3002",
  cards: "\u5E73\u53F0",
  "card.wechat": "\u5FAE\u4FE1",
  "card.feishu": "\u98DE\u4E66",
  "card.wecom": "\u4F01\u4E1A\u5FAE\u4FE1",
  "qr.waiting": "\u6B63\u5728\u83B7\u53D6\u4E8C\u7EF4\u7801\u2026",
  "qr.alt": "\u767B\u5F55\u4E8C\u7EF4\u7801",
  "qr.refresh": "\u5237\u65B0\u4E8C\u7EF4\u7801",
  "qr.refreshHint": "\u70B9\u51FB\u4E8C\u7EF4\u7801\u53EF\u5237\u65B0",
  "qr.confirmed": "\u767B\u5F55\u6210\u529F\uFF0C\u673A\u5668\u4EBA\u5DF2\u63A5\u5165\u3002",
  "bindings.title": "\u5DF2\u7ED1\u5B9A\u7684\u673A\u5668\u4EBA",
  "bindings.empty": "\u8FD8\u6CA1\u6709\u7ED1\u5B9A\u3002\u624B\u673A\u626B\u7801\u767B\u5F55\u540E\u5728 IM \u4E0A\u53D1\u9001 /bind \u5B8C\u6210\u7ED1\u5B9A\u3002",
  "bindings.kind": "\u5E73\u53F0",
  "bindings.session": "\u4F1A\u8BDD",
  "bindings.boundAt": "\u7ED1\u5B9A\u65F6\u95F4",
  "bindings.remove": "\u89E3\u7ED1",
  "bindings.paused": "\uFF08\u9875\u9762\u5DF2\u9690\u85CF\uFF0C\u5217\u8868\u6682\u505C\u5237\u65B0\uFF09",
  "bind.commandTitle": "\u5B8C\u6210\u7ED1\u5B9A",
  "bind.commandHint": "\u5728 IM \u4E0A\u53D1\u9001\u4EE5\u4E0B\u547D\u4EE4\u5B8C\u6210\u7ED1\u5B9A\uFF1A",
  "steps.title.wechat": "\u5FAE\u4FE1\u63A5\u5165\u6B65\u9AA4",
  "step.wechat.1": "\u7528\u624B\u673A\u5FAE\u4FE1\u300C\u626B\u4E00\u626B\u300D\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801\u3002",
  "step.wechat.2": "\u5728\u624B\u673A\u4E0A\u786E\u8BA4\u6388\u6743\uFF0C\u5B8C\u6210\u673A\u5668\u4EBA\u7ED1\u5B9A\u3002",
  "step.wechat.3": "\u9875\u9762\u63D0\u793A\u300C\u767B\u5F55\u6210\u529F\u300D\u540E\uFF0C\u5373\u53EF\u5728\u5FAE\u4FE1\u91CC\u4E0E\u673A\u5668\u4EBA\u5BF9\u8BDD\u3002",
  "step.wechat.4": "\u53D1\u9001 /bind \u7ED1\u5B9A\u4F60\u7684\u4F1A\u8BDD\u3002",
  "note.wechat.verifycode": "\u5982\u5FAE\u4FE1\u8981\u6C42\u8F93\u5165\u9A8C\u8BC1\u7801\uFF0C\u8BF7\u5728\u542F\u52A8 harness \u7684\u7EC8\u7AEF\u4E2D\u6539\u7528\u7EC8\u7AEF\u767B\u5F55\u6D41\u7A0B\u3002",
  "steps.title.feishu": "\u98DE\u4E66\u63A5\u5165\u6B65\u9AA4",
  "step.feishu.1": "\u7528\u624B\u673A\u98DE\u4E66\u300C\u626B\u4E00\u626B\u300D\u626B\u63CF\u5DE6\u4FA7\u4E8C\u7EF4\u7801\u3002",
  "step.feishu.2": "\u5728\u98DE\u4E66\u6388\u6743\u9875\u9009\u62E9\u300C\u521B\u5EFA\u65B0\u5E94\u7528\u300D\u6216\u7ED1\u5B9A\u5DF2\u6709\u5E94\u7528\u3002",
  "step.feishu.3": "\u786E\u8BA4\u6388\u6743\u2014\u2014\u5E94\u7528\u4F1A\u81EA\u52A8\u914D\u597D\u673A\u5668\u4EBA\u80FD\u529B\u4E0E\u4E8B\u4EF6\u8BA2\u9605\u3002",
  "step.feishu.4": "\u9875\u9762\u63D0\u793A\u300C\u767B\u5F55\u6210\u529F\u300D\u540E\uFF0C\u5373\u53EF\u5728\u98DE\u4E66\u91CC\u4E0E\u673A\u5668\u4EBA\u5BF9\u8BDD\u3002",
  "steps.title.wecom": "\u4F01\u4E1A\u5FAE\u4FE1\u63A5\u5165\u6B65\u9AA4",
  "step.wecom.1": "\u767B\u5F55\u4F01\u4E1A\u5FAE\u4FE1\u7BA1\u7406\u540E\u53F0\uFF08work.weixin.qq.com\uFF09\u3002",
  "step.wecom.2": "\u8FDB\u5165\u300C\u5E94\u7528 \u2192 \u667A\u80FD\u673A\u5668\u4EBA\u300D\u9875\u9762\uFF0C\u521B\u5EFA\u6216\u9009\u4E2D\u4E00\u4E2A\u673A\u5668\u4EBA\u3002",
  "step.wecom.3": "\u5728\u300CAPI \u63A5\u6536\u4E8B\u4EF6\u300D\u4E2D\u9009\u62E9\u300C\u957F\u8FDE\u63A5\u300D\u6A21\u5F0F\uFF0C\u590D\u5236 BotID \u548C Secret\u3002",
  "step.wecom.4": "\u5728\u4E0B\u65B9\u8F93\u5165\u6846\u4E2D\u7C98\u8D34 BotID \u548C Secret\uFF0C\u70B9\u51FB\u4FDD\u5B58\u5373\u53EF\u8FDE\u63A5\u3002",
  "note.wecom": "BotID \u548C Secret \u4EC5\u4FDD\u5B58\u5728\u672C\u5730\uFF0C\u4E0D\u4F1A\u4E0A\u4F20\u5230\u4EFB\u4F55\u7B2C\u4E09\u65B9\u670D\u52A1\u5668\u3002",
  "rail.title": "\u673A\u5668\u4EBA\u72B6\u6001",
  "rail.expand": "\u5C55\u5F00\u673A\u5668\u4EBA\u72B6\u6001",
  "rail.collapse": "\u6536\u8D77\u673A\u5668\u4EBA\u72B6\u6001",
  "rail.online": "\u5728\u7EBF",
  "rail.offline": "\u79BB\u7EBF",
  "rail.unbound": "\u672A\u7ED1\u5B9A",
  "rail.usersSuffix": " \u4E2A\u7ED1\u5B9A\u7528\u6237",
  "rail.usersNone": "\u6682\u65E0\u7ED1\u5B9A\u7528\u6237",
  "rail.loadError": "\u72B6\u6001\u83B7\u53D6\u5931\u8D25",
  "rail.retry": "\u91CD\u8BD5"
};
var en = {
  nav: "Mobile Connect",
  intro: "Pick a platform and scan the QR code from your phone to create/bind your bot.",
  cards: "Platform",
  "card.wechat": "WeChat",
  "card.feishu": "Feishu",
  "card.wecom": "WeCom",
  "qr.waiting": "Fetching QR code\u2026",
  "qr.alt": "Login QR code",
  "qr.refresh": "Refresh QR code",
  "qr.refreshHint": "Click the QR code to refresh",
  "qr.confirmed": "Logged in \u2014 your bot is connected.",
  "bindings.title": "Bound bots",
  "bindings.empty": "No bindings yet. Scan to log in, then send /bind from your IM.",
  "bindings.kind": "Platform",
  "bindings.session": "Session",
  "bindings.boundAt": "Bound at",
  "bindings.remove": "Unbind",
  "bindings.paused": "(Tab is hidden; the list is paused.)",
  "bind.commandTitle": "Finish binding",
  "bind.commandHint": "Send this command in your IM to bind:",
  "steps.title.wechat": "WeChat setup",
  "step.wechat.1": "Scan the QR code with WeChat on your phone.",
  "step.wechat.2": "Confirm the authorization to bind your bot.",
  "step.wechat.3": "Once the page says connected, chat with your bot in WeChat.",
  "step.wechat.4": "Send /bind to bind your session.",
  "note.wechat.verifycode": "If WeChat asks for a verification code, use the terminal login flow in the terminal running the harness.",
  "steps.title.feishu": "Feishu setup",
  "step.feishu.1": "Scan the QR code with Feishu on your phone.",
  "step.feishu.2": 'Choose "create a new app" or bind an existing one.',
  "step.feishu.3": "Confirm \u2014 bot capability and event subscriptions are configured automatically.",
  "step.feishu.4": "Once the page says connected, chat with your bot in Feishu.",
  "steps.title.wecom": "WeCom setup",
  "step.wecom.1": "Log in to the WeCom admin console (work.weixin.qq.com).",
  "step.wecom.2": 'Go to "Apps \u2192 Intelligent Bot" and create or select a bot.',
  "step.wecom.3": 'Under "API Event Receiving", choose "Long Connection" mode, then copy BotID and Secret.',
  "step.wecom.4": "Paste BotID and Secret in the form below and click Save to connect.",
  "note.wecom": "BotID and Secret are stored locally and never sent to any third-party server.",
  "rail.title": "Bot status",
  "rail.expand": "Show bot status",
  "rail.collapse": "Hide bot status",
  "rail.online": "Online",
  "rail.offline": "Offline",
  "rail.unbound": "Not set up",
  "rail.usersSuffix": " bound users",
  "rail.usersNone": "No bound users",
  "rail.loadError": "Failed to load status",
  "rail.retry": "Retry"
};

// src/client/store.ts
var KINDS = ["feishu", "wechat", "wecom"];

// src/client/index.ts
var NS = "settings.im";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-settings-im: copy dictionaries");
  const t = ctx.locale.bind(NS);
  const injected = () => ({ t: (key) => t(key) });
  ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
    name: "settings.plugins.tab",
    id: "bot-channel",
    order: 10,
    label: () => t("nav"),
    locale: NS,
    inject: injected
  }, BotChannelTab));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "im-bots-rail",
    order: 100,
    locale: NS,
    inject: () => ({ t: (key) => t(key) })
  }, ImBotsRail));
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
