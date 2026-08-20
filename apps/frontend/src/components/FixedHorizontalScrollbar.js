import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
export function FixedHorizontalScrollbar({ targetRef }) {
    const scrollbarRef = useRef(null);
    const syncingRef = useRef(false);
    const [metrics, setMetrics] = useState({
        left: 0,
        width: 0,
        contentWidth: 0,
        visible: false,
    });
    useEffect(() => {
        let animationFrame = 0;
        let cleanupTarget;
        const attach = () => {
            const target = targetRef.current;
            if (!target) {
                animationFrame = window.requestAnimationFrame(attach);
                return;
            }
            const measure = () => {
                const rect = target.getBoundingClientRect();
                const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
                setMetrics({
                    left: Math.max(rect.left, 0),
                    width,
                    contentWidth: target.scrollWidth,
                    visible: window.innerWidth >= 768 &&
                        target.scrollWidth > target.clientWidth + 1 &&
                        rect.top < window.innerHeight &&
                        rect.bottom > 0,
                });
            };
            const syncFromTarget = () => {
                if (syncingRef.current)
                    return;
                syncingRef.current = true;
                if (scrollbarRef.current)
                    scrollbarRef.current.scrollLeft = target.scrollLeft;
                syncingRef.current = false;
            };
            const resizeObserver = new ResizeObserver(measure);
            const mutationObserver = new MutationObserver(measure);
            resizeObserver.observe(target);
            mutationObserver.observe(target, { childList: true, subtree: true });
            target.addEventListener('scroll', syncFromTarget, { passive: true });
            window.addEventListener('resize', measure);
            window.addEventListener('scroll', measure, { passive: true });
            measure();
            cleanupTarget = () => {
                resizeObserver.disconnect();
                mutationObserver.disconnect();
                target.removeEventListener('scroll', syncFromTarget);
                window.removeEventListener('resize', measure);
                window.removeEventListener('scroll', measure);
            };
        };
        attach();
        return () => {
            window.cancelAnimationFrame(animationFrame);
            cleanupTarget?.();
        };
    }, [targetRef]);
    if (!metrics.visible)
        return null;
    return (_jsx("div", { className: "fixed bottom-0 z-50 border-x border-t border-slate-300 bg-white/95 px-1 pt-1 shadow-[0_-4px_14px_rgba(15,23,42,0.12)] backdrop-blur", style: { left: metrics.left, width: metrics.width }, "aria-label": "Rolagem horizontal da tabela", children: _jsx("div", { ref: scrollbarRef, className: "fixed-horizontal-scrollbar h-5 overflow-x-scroll overflow-y-hidden", onScroll: (event) => {
                if (syncingRef.current || !targetRef.current)
                    return;
                syncingRef.current = true;
                targetRef.current.scrollLeft = event.currentTarget.scrollLeft;
                syncingRef.current = false;
            }, children: _jsx("div", { style: { width: metrics.contentWidth, height: 1 } }) }) }));
}
