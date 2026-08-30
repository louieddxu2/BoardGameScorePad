import React from 'react';
import {
  getElementOverflow,
  getViewportBottomDelta,
  isSessionViewportDiagnosticsEnabled,
} from '../../../utils/sessionViewportDiagnostics';

type ElementMeasurement = {
  clientHeight: number;
  scrollHeight: number;
  top: number;
  bottom: number;
  overflow: number;
};

type DiagnosticsSnapshot = {
  appZoom: number;
  rootFontSize: number;
  visualHeight: number;
  visualOffsetTop: number;
  visualScale: number;
  visualBottom: number;
  innerHeight: number;
  rootClientHeight: number;
  panelBottomDelta: number | null;
  elements: Record<string, ElementMeasurement | null>;
};

const round = (value: number): string => Number.isFinite(value) ? value.toFixed(1) : 'n/a';

const measureElement = (selector: string): ElementMeasurement | null => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    top: rect.top,
    bottom: rect.bottom,
    overflow: getElementOverflow(element.clientHeight, element.scrollHeight),
  };
};

const collectSnapshot = (): DiagnosticsSnapshot => {
  const visualViewport = window.visualViewport;
  const visualHeight = visualViewport?.height ?? window.innerHeight;
  const visualOffsetTop = visualViewport?.offsetTop ?? 0;
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const elements = {
    panel: measureElement('[data-session-input-panel="true"]'),
    content: measureElement('[data-session-input-content="true"]'),
    layout: measureElement('[data-input-panel-layout="true"]'),
    keypad: measureElement('[data-numeric-keypad="true"]'),
  };

  return {
    appZoom: rootFontSize / 16,
    rootFontSize,
    visualHeight,
    visualOffsetTop,
    visualScale: visualViewport?.scale ?? 1,
    visualBottom: visualOffsetTop + visualHeight,
    innerHeight: window.innerHeight,
    rootClientHeight: document.documentElement.clientHeight,
    panelBottomDelta: elements.panel
      ? getViewportBottomDelta(elements.panel.bottom, visualHeight, visualOffsetTop)
      : null,
    elements,
  };
};

const formatElement = (label: string, measurement: ElementMeasurement | null): string => {
  if (!measurement) return `${label}: missing`;
  return `${label}: c${measurement.clientHeight} s${measurement.scrollHeight} o${measurement.overflow} t${round(measurement.top)} b${round(measurement.bottom)}`;
};

const SessionViewportDiagnostics: React.FC = () => {
  const enabled = typeof window !== 'undefined' &&
    isSessionViewportDiagnosticsEnabled(window.location.search);
  const [snapshot, setSnapshot] = React.useState<DiagnosticsSnapshot | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const update = () => setSnapshot(collectSnapshot());
    update();
    const intervalId = window.setInterval(update, 250);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(intervalId);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);

  if (!enabled || !snapshot) return null;

  return (
    <output
      data-session-viewport-diagnostics="true"
      className="fixed left-1 top-1 z-[10000] pointer-events-none whitespace-pre rounded bg-black/90 px-2 py-1 font-mono text-[10px] leading-tight text-white shadow-xl"
    >
      {`appZoom ${round(snapshot.appZoom)} root ${round(snapshot.rootFontSize)}px\n`}
      {`vv h${round(snapshot.visualHeight)} top${round(snapshot.visualOffsetTop)} scale${round(snapshot.visualScale)} bottom${round(snapshot.visualBottom)}\n`}
      {`layout inner${snapshot.innerHeight} root${snapshot.rootClientHeight} panelDelta${snapshot.panelBottomDelta === null ? 'n/a' : round(snapshot.panelBottomDelta)}\n`}
      {`${formatElement('panel', snapshot.elements.panel)}\n`}
      {`${formatElement('content', snapshot.elements.content)}\n`}
      {`${formatElement('layout', snapshot.elements.layout)}\n`}
      {formatElement('keypad', snapshot.elements.keypad)}
    </output>
  );
};

export default SessionViewportDiagnostics;
