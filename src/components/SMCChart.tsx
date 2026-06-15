import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

export const SMCChart = ({ data, colors }: { data: any[], colors?: any }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const { backgroundColor = '#0d1824', textColor = '#e2e8f0', upColor = '#22c55e', downColor = '#ef4444' } = colors || {};

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: backgroundColor }, textColor },
            grid: { vertLines: { color: '#1e3a52' }, horzLines: { color: '#1e3a52' } },
            crosshair: { mode: CrosshairMode.Normal },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: { timeVisible: true, secondsVisible: false },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor, downColor, borderVisible: false, wickUpColor: upColor, wickDownColor: downColor,
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [backgroundColor, textColor, upColor, downColor]);

    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;
        
        const formattedData = data.map((d: any) => ({
            time: d.t / 1000,
            open: d.o, high: d.h, low: d.l, close: d.c,
        }));

        const uniqueData = formattedData.filter((v: any, i: number, a: any) => a.findIndex((v2: any) => (v2.time === v.time)) === i);
        uniqueData.sort((a: any, b: any) => a.time - b.time);

        seriesRef.current.setData(uniqueData);
    }, [data]);

    return <div ref={chartContainerRef} style={{ width: '100%', height: '500px', border: '1px solid #1e3a52', borderRadius: '8px', overflow: 'hidden' }} />;
};
