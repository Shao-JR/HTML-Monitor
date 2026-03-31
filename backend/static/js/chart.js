// backend/static/js/chart.js
class ChartManager {
    constructor() {
        this.charts = {};
        this.allData = [];
        this.maxDataPoints = 50;
        this.currentViewStart = 0;
        this.visiblePoints = 20;
        
        // 图表配置
        this.chartConfigs = {
            tempChart: {
                label: '温度 (°C)',
                color: '#3b82f6',
                unit: '°C',
                yMin: 10,
                yMax: 40,
                yStep: 2,
                decimals: 1
            },
            humidityChart: {
                label: '湿度 (%)',
                color: '#10b981',
                unit: '%',
                yMin: 20,
                yMax: 80,
                yStep: 5,
                decimals: 0
            },
            cpuChart: {
                label: 'CPU使用率 (%)',
                color: '#8b5cf6',
                unit: '%',
                yMin: 0,
                yMax: 100,
                yStep: 10,
                decimals: 0
            },
            memoryChart: {
                label: '内存使用率 (%)',
                color: '#f59e0b',
                unit: '%',
                yMin: 0,
                yMax: 100,
                yStep: 10,
                decimals: 0
            }
        };
    }
    
    // 初始化所有图表
    initAllCharts() {
        for (const chartId in this.chartConfigs) {
            this.initChart(chartId);
        }
        console.log('所有图表初始化完成');
    }
    
    // 初始化单个图表
    initChart(chartId) {
        const ctx = document.getElementById(chartId);
        if (!ctx) {
            console.error(`找不到Canvas元素: ${chartId}`);
            return null;
        }
        
        const config = this.chartConfigs[chartId];
        
        this.charts[chartId] = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: config.label,
                    data: [],
                    borderColor: config.color,
                    backgroundColor: this.hexToRgba(config.color, 0.1),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: config.color,
                    pointBorderColor: 'white',
                    pointBorderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions(chartId, config)
        });
        
        return this.charts[chartId];
    }
    
    // 获取图表配置
    getChartOptions(chartId, config) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: 12,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        label: (context) => {
                            return `${config.label}: ${this.formatNumber(context.parsed.y, config.decimals)}${config.unit}`;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl'
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        onZoomComplete: ({ chart }) => {
                            this.updateChartControls(chart);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        maxRotation: 0,
                        callback: (value, index, values) => {
                            if (index % Math.ceil(values.length / 8) === 0 || index === values.length - 1) {
                                return this.allData[this.currentViewStart + index]?.timestamp || '';
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: '时间',
                        font: {
                            size: 12
                        }
                    },
                    min: 0,
                    max: this.visiblePoints - 1
                },
                y: {
                    min: config.yMin,
                    max: config.yMax,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: config.label.split(' ')[0],
                        font: {
                            size: 12
                        }
                    },
                    ticks: {
                        stepSize: config.yStep,
                        callback: (value) => {
                            return this.formatNumber(value, config.decimals);
                        },
                        padding: 5
                    },
                    afterDataLimits: (scale) => {
                        // 确保Y轴范围是整齐的
                        const range = scale.max - scale.min;
                        const niceStep = this.getNiceStep(range, config.yStep);
                        
                        // 计算漂亮的min和max
                        const niceMin = Math.floor(scale.min / niceStep) * niceStep;
                        const niceMax = Math.ceil(scale.max / niceStep) * niceStep;
                        
                        scale.min = Math.max(config.yMin, niceMin);
                        scale.max = Math.min(config.yMax, niceMax);
                        
                        // 确保步长是整数
                        scale.options.ticks.stepSize = niceStep;
                    }
                }
            }
        };
    }
    
    // 计算漂亮的步长
    getNiceStep(range, preferredStep) {
        if (range <= 0) return preferredStep;
        
        // 定义可能的步长
        const niceSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
        
        // 计算理想的步长
        const idealStep = range / 5;
        
        // 找到最接近的理想步长
        let bestStep = niceSteps[0];
        for (const step of niceSteps) {
            if (step >= idealStep) {
                bestStep = step;
                break;
            }
        }
        
        // 确保不超过首选步长
        return Math.min(bestStep, preferredStep);
    }
    
    // 格式化数字，修复浮点数精度问题
    formatNumber(value, decimals = 1) {
        if (value === null || value === undefined) return '0';
        
        // 修复浮点数精度
        const factor = Math.pow(10, decimals);
        const fixedValue = Math.round(value * factor) / factor;
        
        // 使用toFixed但去除多余的0
        let formatted = fixedValue.toFixed(decimals);
        
        // 移除末尾的0和小数点
        if (decimals > 0) {
            formatted = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
        }
        
        return formatted;
    }
    
    // 添加新数据
    addData(newData) {
        if (!newData) return;
        
        // 格式化数据，修复浮点数精度
        const formattedData = {
            ...newData,
            temperature: this.formatNumber(newData.temperature, 1),
            humidity: this.formatNumber(newData.humidity, 0),
            cpu_usage: this.formatNumber(newData.cpu_usage, 0),
            memory_usage: this.formatNumber(newData.memory_usage, 0)
        };
        
        // 添加到数据数组
        this.allData.push(formattedData);
        
        // 限制总数据量
        if (this.allData.length > this.maxDataPoints) {
            this.allData.shift();
        }
        
        // 如果当前视图在末尾，则自动滚动
        if (this.currentViewStart + this.visiblePoints >= this.allData.length) {
            this.currentViewStart = Math.max(0, this.allData.length - this.visiblePoints);
        }
        
        // 更新视图
        this.updateView();
        
        return formattedData;
    }
    
    // 更新图表视图
    updateView() {
        if (this.allData.length === 0) return;
        
        // 获取当前视图的数据
        const viewData = this.allData.slice(
            this.currentViewStart, 
            Math.min(this.currentViewStart + this.visiblePoints, this.allData.length)
        );
        
        if (viewData.length === 0) return;
        
        const labels = viewData.map(d => d.timestamp);
        
        // 更新每个图表
        for (const chartId in this.charts) {
            const chart = this.charts[chartId];
            if (!chart) continue;
            
            const dataField = this.getDataField(chartId);
            const data = viewData.map(d => parseFloat(d[dataField]));
            
            chart.data.labels = labels;
            chart.data.datasets[0].data = data;
            
            // 更新Y轴范围
            this.updateYAxisRange(chartId, data);
            
            // 更新图表
            chart.update('none');
        }
    }
    
    // 获取数据字段名
    getDataField(chartId) {
        const fieldMap = {
            tempChart: 'temperature',
            humidityChart: 'humidity',
            cpuChart: 'cpu_usage',
            memoryChart: 'memory_usage'
        };
        return fieldMap[chartId] || 'value';
    }
    
    // 更新Y轴范围
    updateYAxisRange(chartId, data) {
        if (data.length === 0) return;
        
        const chart = this.charts[chartId];
        if (!chart) return;
        
        const config = this.chartConfigs[chartId];
        const validData = data.filter(d => !isNaN(d));
        
        if (validData.length === 0) return;
        
        let minValue = Math.min(...validData);
        let maxValue = Math.max(...validData);
        
        // 添加一些边距
        const range = maxValue - minValue;
        const margin = range * 0.1;
        
        minValue = minValue - margin;
        maxValue = maxValue + margin;
        
        // 确保在预设范围内
        minValue = Math.max(config.yMin, minValue);
        maxValue = Math.min(config.yMax, maxValue);
        
        // 确保Y轴范围是整齐的
        const step = config.yStep;
        minValue = Math.floor(minValue / step) * step;
        maxValue = Math.ceil(maxValue / step) * step;
        
        // 确保至少有一定范围
        if (maxValue - minValue < step) {
            maxValue = minValue + step;
        }
        
        // 更新图表配置
        chart.options.scales.y.min = this.formatNumber(minValue, config.decimals);
        chart.options.scales.y.max = this.formatNumber(maxValue, config.decimals);
    }
    
    // 导航控制
    goToStart() {
        this.currentViewStart = 0;
        this.updateView();
    }
    
    goToEnd() {
        this.currentViewStart = Math.max(0, this.allData.length - this.visiblePoints);
        this.updateView();
    }
    
    scrollLeft() {
        this.currentViewStart = Math.max(0, this.currentViewStart - 5);
        this.updateView();
    }
    
    scrollRight() {
        this.currentViewStart = Math.min(
            this.allData.length - this.visiblePoints,
            this.currentViewStart + 5
        );
        this.updateView();
    }
    
    // 放大缩小
    zoomIn() {
        this.visiblePoints = Math.max(5, this.visiblePoints - 5);
        this.currentViewStart = Math.min(
            this.currentViewStart,
            this.allData.length - this.visiblePoints
        );
        this.updateView();
    }
    
    zoomOut() {
        this.visiblePoints = Math.min(this.maxDataPoints, this.visiblePoints + 5);
        this.currentViewStart = Math.max(
            0,
            this.allData.length - this.visiblePoints
        );
        this.updateView();
    }
    
    // 重置视图
    resetView() {
        this.visiblePoints = 20;
        this.currentViewStart = Math.max(0, this.allData.length - this.visiblePoints);
        this.updateView();
    }
    
    // 更新图表控制状态显示
    updateChartControls(chart) {
        const xScale = chart.scales.x;
        if (xScale && xScale.min !== undefined && xScale.max !== undefined) {
            console.log('当前视图范围:', xScale.min, '到', xScale.max);
        }
    }
    
    // 加载历史数据
    loadHistoricalData(historicalData) {
        if (!historicalData || !Array.isArray(historicalData)) return;
        
        // 格式化历史数据
        this.allData = historicalData.map(item => ({
            ...item,
            temperature: this.formatNumber(item.temperature, 1),
            humidity: this.formatNumber(item.humidity, 0),
            cpu_usage: this.formatNumber(item.cpu_usage, 0),
            memory_usage: this.formatNumber(item.memory_usage, 0)
        }));
        
        if (this.allData.length > this.maxDataPoints) {
            this.allData = this.allData.slice(-this.maxDataPoints);
        }
        
        this.currentViewStart = Math.max(0, this.allData.length - this.visiblePoints);
        this.updateView();
    }
    
    // 获取当前视图信息
    getViewInfo() {
        return {
            totalPoints: this.allData.length,
            viewStart: this.currentViewStart,
            viewEnd: Math.min(this.currentViewStart + this.visiblePoints, this.allData.length),
            visiblePoints: this.visiblePoints,
            maxPoints: this.maxDataPoints
        };
    }
    
    // 获取统计数据
    getStatistics() {
        if (this.allData.length === 0) {
            return null;
        }
        
        const latest = this.allData[this.allData.length - 1];
        const viewData = this.allData.slice(
            this.currentViewStart, 
            this.currentViewStart + this.visiblePoints
        );
        
        if (viewData.length === 0) return null;
        
        const temperatures = viewData.map(d => parseFloat(d.temperature));
        const humidities = viewData.map(d => parseFloat(d.humidity));
        const cpuUsages = viewData.map(d => parseFloat(d.cpu_usage));
        const memoryUsages = viewData.map(d => parseFloat(d.memory_usage));
        
        return {
            latest: latest,
            viewInfo: this.getViewInfo(),
            temperature: this.calculateStats(temperatures, '温度', 1),
            humidity: this.calculateStats(humidities, '湿度', 0),
            cpu: this.calculateStats(cpuUsages, 'CPU', 0),
            memory: this.calculateStats(memoryUsages, '内存', 0)
        };
    }
    
    // 计算统计数据
    calculateStats(data, field, decimals) {
        if (data.length === 0) {
            return { 
                current: 0, 
                avg: 0, 
                min: 0, 
                max: 0,
                formattedCurrent: '0',
                formattedAvg: '0',
                formattedMin: '0',
                formattedMax: '0'
            };
        }
        
        const current = data[data.length - 1];
        const avg = this.calculateAverage(data);
        const min = Math.min(...data);
        const max = Math.max(...data);
        
        return {
            current: current,
            avg: avg,
            min: min,
            max: max,
            formattedCurrent: this.formatNumber(current, decimals),
            formattedAvg: this.formatNumber(avg, decimals),
            formattedMin: this.formatNumber(min, decimals),
            formattedMax: this.formatNumber(max, decimals)
        };
    }
    
    // 计算平均值
    calculateAverage(arr) {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }
    
    // 辅助函数：十六进制颜色转RGBA
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// 导出为全局变量
window.ChartManager = ChartManager;