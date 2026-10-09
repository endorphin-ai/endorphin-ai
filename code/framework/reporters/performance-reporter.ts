/**
 * Simple Performance Report Generator
 * Creates a standalone HTML report for performance metrics
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CIPerformanceMetrics } from '../core/ci-performance.js';
import { warn, logSuccess } from '../core/logger.js';

interface TestSummary {
  testName: string;
  sessionId: string;
  status: 'SUCCESS' | 'FAILED';
  startTime: string;
  endTime: string;
  duration: number;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalScreenshots: number;
}

export class PerformanceReporter {
  /**
   * Read all test summary files from the output directory
   */
  private readTestSummaries(outputDir: string): TestSummary[] {
    const summaries: TestSummary[] = [];
    
    try {
      if (!fs.existsSync(outputDir)) {
        return summaries;
      }

      const entries = fs.readdirSync(outputDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const summaryPath = path.join(outputDir, entry.name, 'summary.json');
          if (fs.existsSync(summaryPath)) {
            try {
              const summaryContent = fs.readFileSync(summaryPath, 'utf8');
              const summary: TestSummary = JSON.parse(summaryContent);
              summaries.push(summary);
            } catch (error) {
              warn(`Failed to read summary file: ${summaryPath}`, { summaryPath, error: String(error) }, 'PerformanceReporter');
            }
          }
        }
      }
    } catch (error) {
      warn(`Failed to read test summaries from ${outputDir}`, { outputDir, error: String(error) }, 'PerformanceReporter');
    }

    return summaries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  /**
   * Generate a simple HTML performance report
   */
  generateReport(metrics: CIPerformanceMetrics, outputDir: string = 'test-results'): string {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read test summaries
    const testSummaries = this.readTestSummaries(outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(outputDir, `performance-report-${timestamp}.html`);

    const html = this.generateHtmlContent(metrics, testSummaries);
    
    fs.writeFileSync(reportPath, html, 'utf8');
    
    logSuccess(`Performance report generated: ${reportPath}`, { reportPath }, 'PerformanceReporter');
    
    return reportPath;
  }

  private generateHtmlContent(metrics: CIPerformanceMetrics, testSummaries: TestSummary[] = []): string {
    const duration = metrics.endTime ? 
      ((metrics.endTime - metrics.startTime) / 1000).toFixed(1) : 
      ((Date.now() - metrics.startTime) / 1000).toFixed(1);

    // Calculate test stats from summaries
    const totalTests = testSummaries.length;
    const passedTests = testSummaries.filter(t => t.status === 'SUCCESS').length;
    const failedTests = testSummaries.filter(t => t.status === 'FAILED').length;

    // Check if browser memory data is available
    const hasBrowserMemory = metrics.peakBrowserHeapMB > 0 || metrics.peakDomNodes > 0;

    // Generate timeline data for charts
    const chartData = this.generateChartData(metrics.samples);
    const browserChartData = hasBrowserMemory ? this.generateBrowserChartData(metrics.samples) : null;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - Endorphin AI</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #6c5ce7;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 16px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .stat-card .icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #2d3436;
            margin-bottom: 5px;
        }
        
        .stat-card .label {
            color: #636e72;
            font-size: 14px;
        }
        
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .chart-container h3 {
            margin-bottom: 20px;
            color: #2d3436;
        }
        
        .chart-wrapper {
            position: relative;
            height: 300px;
            width: 100%;
        }
        
        #performanceChart {
            position: absolute !important;
            top: 0;
            left: 0;
            width: 100% !important;
            height: 100% !important;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .badge.enabled {
            background: #00b894;
            color: white;
        }
        
        .badge.disabled {
            background: #636e72;
            color: white;
        }
        
        .optimizer-info {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .optimizer-info h3 {
            margin-bottom: 15px;
            color: #2d3436;
        }
        
        .test-results-container {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .test-results-container h3 {
            margin-bottom: 20px;
            color: #2d3436;
        }
        
        .test-results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .test-results-table th,
        .test-results-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .test-results-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #2d3436;
        }
        
        .test-results-table .status-success {
            color: #00b894;
            font-weight: bold;
        }
        
        .test-results-table .status-failed {
            color: #e74c3c;
            font-weight: bold;
        }
        
        .test-results-table .duration {
            text-align: right;
        }
        
        .timestamp {
            text-align: center;
            color: #636e72;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Performance Report</h1>
            <div class="subtitle">Endorphin AI Test Execution Performance</div>
        </div>
        

        <div class="stats-grid">
            <div class="stat-card">
                <div class="icon">⏱️</div>
                <div class="value">${duration}s</div>
                <div class="label">Test Duration</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">🧪</div>
                <div class="value">${totalTests}</div>
                <div class="label">Tests Executed</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">✅</div>
                <div class="value">${passedTests}</div>
                <div class="label">Tests Passed</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">❌</div>
                <div class="value">${failedTests}</div>
                <div class="label">Tests Failed</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">💾</div>
                <div class="value">${metrics.peakMemoryMB.toFixed(1)}MB</div>
                <div class="label">Peak Memory</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">📈</div>
                <div class="value">${metrics.avgMemoryMB.toFixed(1)}MB</div>
                <div class="label">Average Memory</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">⚡</div>
                <div class="value">${metrics.peakCpuPercent.toFixed(1)}%</div>
                <div class="label">Peak CPU</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">🔄</div>
                <div class="value">${metrics.avgCpuPercent.toFixed(1)}%</div>
                <div class="label">Average CPU</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">🗑️</div>
                <div class="value">${metrics.gcCount}</div>
                <div class="label">GC Triggers</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">🧹</div>
                <div class="value">${metrics.cleanupCount}</div>
                <div class="label">Cleanups</div>
            </div>
            
            ${hasBrowserMemory ? `
            <div class="stat-card">
                <div class="icon">🌐</div>
                <div class="value">${metrics.peakBrowserHeapMB.toFixed(1)}MB</div>
                <div class="label">Peak Browser Heap</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">📊</div>
                <div class="value">${metrics.avgBrowserHeapMB.toFixed(1)}MB</div>
                <div class="label">Avg Browser Heap</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">📄</div>
                <div class="value">${metrics.peakDomNodes}</div>
                <div class="label">Peak DOM Nodes</div>
            </div>
            
            <div class="stat-card">
                <div class="icon">📋</div>
                <div class="value">${Math.round(metrics.avgDomNodes)}</div>
                <div class="label">Avg DOM Nodes</div>
            </div>
            ` : ''}
        </div>

        <div class="chart-container">
            <h3>💾 Memory Usage Timeline</h3>
            <div class="chart-wrapper">
                <canvas id="memoryChart"></canvas>
            </div>
            <p style="margin-top: 10px; color: #636e72; font-size: 12px; text-align: center;">
                ${metrics.samples.length > 50 ? `Showing ${Math.min(51, metrics.samples.length)} of ${metrics.samples.length} samples for clarity` : `Showing all ${metrics.samples.length} samples`}
            </p>
        </div>

        <div class="chart-container">
            <h3>⚡ CPU Usage Timeline</h3>
            <div class="chart-wrapper">
                <canvas id="cpuChart"></canvas>
            </div>
            <p style="margin-top: 10px; color: #636e72; font-size: 12px; text-align: center;">
                ${metrics.samples.length > 50 ? `Showing ${Math.min(51, metrics.samples.length)} of ${metrics.samples.length} samples for clarity` : `Showing all ${metrics.samples.length} samples`}
            </p>
        </div>

        ${hasBrowserMemory && browserChartData ? `
        <div class="chart-container">
            <h3>🌐 Browser Heap Memory Timeline</h3>
            <div class="chart-wrapper">
                <canvas id="browserHeapChart"></canvas>
            </div>
            <p style="margin-top: 10px; color: #636e72; font-size: 12px; text-align: center;">
                Browser JavaScript heap usage over time
            </p>
        </div>

        <div class="chart-container">
            <h3>📄 DOM Nodes Timeline</h3>
            <div class="chart-wrapper">
                <canvas id="domNodesChart"></canvas>
            </div>
            <p style="margin-top: 10px; color: #636e72; font-size: 12px; text-align: center;">
                Number of DOM nodes over time
            </p>
        </div>
        ` : ''}

        ${testSummaries.length > 0 ? `
        <div class="test-results-container">
            <h3>📋 Test Results Summary</h3>
            <p>All tests executed during this session:</p>
            <table class="test-results-table">
                <thead>
                    <tr>
                        <th>Test ID</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Steps</th>
                        <th>Start Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${testSummaries.map(test => `
                    <tr>
                        <td><strong>${test.sessionId}</strong></td>
                        <td class="${test.status === 'SUCCESS' ? 'status-success' : 'status-failed'}">
                            ${test.status === 'SUCCESS' ? '✅ PASSED' : '❌ FAILED'}
                        </td>
                        <td class="duration">${(test.duration / 1000).toFixed(1)}s</td>
                        <td>${test.successfulSteps}/${test.totalSteps}</td>
                        <td>${new Date(test.startTime).toLocaleString()}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <div class="timestamp">
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>

    <script>
        const chartData = ${chartData};
        ${hasBrowserMemory && browserChartData ? `const browserChartData = ${browserChartData};` : ''}
        
        // Memory Chart
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        const memoryChart = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Memory (MB)',
                        data: chartData.memory,
                        borderColor: '#6c5ce7',
                        backgroundColor: 'rgba(108, 92, 231, 0.1)',
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.5,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'Memory (MB)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });

        // CPU Chart
        const cpuCtx = document.getElementById('cpuChart').getContext('2d');
        const cpuChart = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'CPU (%)',
                        data: chartData.cpu,
                        borderColor: '#00b894',
                        backgroundColor: 'rgba(0, 184, 148, 0.1)',
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.5,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'CPU (%)'
                        },
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });

        ${hasBrowserMemory && browserChartData ? `
        // Browser Heap Memory Chart
        const browserHeapCtx = document.getElementById('browserHeapChart').getContext('2d');
        const browserHeapChart = new Chart(browserHeapCtx, {
            type: 'line',
            data: {
                labels: browserChartData.labels,
                datasets: [
                    {
                        label: 'Browser Heap (MB)',
                        data: browserChartData.browserHeap,
                        borderColor: '#fd79a8',
                        backgroundColor: 'rgba(253, 121, 168, 0.1)',
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.5,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'Heap Memory (MB)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });

        // DOM Nodes Chart
        const domNodesCtx = document.getElementById('domNodesChart').getContext('2d');
        const domNodesChart = new Chart(domNodesCtx, {
            type: 'line',
            data: {
                labels: browserChartData.labels,
                datasets: [
                    {
                        label: 'DOM Nodes',
                        data: browserChartData.domNodes,
                        borderColor: '#fdcb6e',
                        backgroundColor: 'rgba(253, 203, 110, 0.1)',
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2.5,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'Number of Nodes'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
        
        // Force resize to prevent charts growing
        browserHeapChart.resize();
        domNodesChart.resize();
        ` : ''}
        
        // Force resize to prevent charts growing
        memoryChart.resize();
        cpuChart.resize();
    </script>
</body>
</html>`;
  }

  private generateChartData(samples: Array<{ timestamp: number; memoryMB: number; cpuPercent: number }>): string {
    if (samples.length === 0) {
      return JSON.stringify({
        labels: [],
        memory: [],
        cpu: []
      });
    }

    // Limit data points to prevent chart overload
    const maxPoints = 50;
    let processedSamples = samples;
    
    // If we have too many samples, downsample them
    if (samples.length > maxPoints) {
      const step = Math.ceil(samples.length / maxPoints);
      processedSamples = [];
      for (let i = 0; i < samples.length; i += step) {
        processedSamples.push(samples[i]);
      }
      // Always include the last sample
      if (processedSamples[processedSamples.length - 1] !== samples[samples.length - 1]) {
        processedSamples.push(samples[samples.length - 1]);
      }
    }

    const startTime = samples[0].timestamp;
    
    const chartData = {
      labels: processedSamples.map(sample => {
        const secondsElapsed = Math.round((sample.timestamp - startTime) / 1000);
        return `${secondsElapsed}s`;
      }),
      memory: processedSamples.map(sample => Math.round(sample.memoryMB * 10) / 10),
      cpu: processedSamples.map(sample => Math.round(sample.cpuPercent * 10) / 10)
    };

    return JSON.stringify(chartData);
  }

  private generateBrowserChartData(samples: Array<{ timestamp: number; browserHeapUsedMB?: number; domNodes?: number }>): string {
    // Filter samples that have browser memory data
    const browserSamples = samples.filter(sample => 
      sample.browserHeapUsedMB !== undefined && sample.domNodes !== undefined
    );

    if (browserSamples.length === 0) {
      return JSON.stringify({
        labels: [],
        browserHeap: [],
        domNodes: []
      });
    }

    // Limit data points to prevent chart overload
    const maxPoints = 50;
    let processedSamples = browserSamples;
    
    // If we have too many samples, downsample them
    if (browserSamples.length > maxPoints) {
      const step = Math.ceil(browserSamples.length / maxPoints);
      processedSamples = [];
      for (let i = 0; i < browserSamples.length; i += step) {
        processedSamples.push(browserSamples[i]);
      }
      // Always include the last sample
      if (processedSamples[processedSamples.length - 1] !== browserSamples[browserSamples.length - 1]) {
        processedSamples.push(browserSamples[browserSamples.length - 1]);
      }
    }

    const startTime = browserSamples[0].timestamp;
    
    const chartData = {
      labels: processedSamples.map(sample => {
        const secondsElapsed = Math.round((sample.timestamp - startTime) / 1000);
        return `${secondsElapsed}s`;
      }),
      browserHeap: processedSamples.map(sample => Math.round((sample.browserHeapUsedMB || 0) * 10) / 10),
      domNodes: processedSamples.map(sample => sample.domNodes || 0)
    };

    return JSON.stringify(chartData);
  }
}