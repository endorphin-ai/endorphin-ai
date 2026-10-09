/**
 * Simple CI Performance Monitoring
 * Lightweight performance tracking that can be safely enabled in CI environments
 */

import { info, error as logError } from './logger.js';

export interface CIPerformanceMetrics {
  startTime: number;
  endTime?: number;
  peakMemoryMB: number;
  avgMemoryMB: number;
  peakCpuPercent: number;
  avgCpuPercent: number;
  peakBrowserHeapMB: number;
  avgBrowserHeapMB: number;
  peakDomNodes: number;
  avgDomNodes: number;
  testCount: number;
  gcCount: number;
  cleanupCount: number;
  memoryOptimizerEnabled: boolean;
  samples: PerformanceSample[];
}

export interface PerformanceSample {
  timestamp: number;
  memoryMB: number;
  cpuPercent: number;
  browserHeapUsedMB?: number;
  browserHeapTotalMB?: number;
  domNodes?: number;
  domDocuments?: number;
}

export class CIPerformanceMonitor {
  private metrics: CIPerformanceMetrics;
  private memorySnapshots: number[] = [];
  private cpuSnapshots: number[] = [];
  private browserHeapSnapshots: number[] = [];
  private domNodesSnapshots: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private consoleInterval: NodeJS.Timeout | null = null;
  private enabled: boolean;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private currentPage: any = null; // Reference to current Playwright page
  private summaryPrinted: boolean = false;
  private isDisposed: boolean = false;

  constructor() {
    // Enable monitoring with ENDORPHIN_PERF_MONITORING
    this.enabled = process.env.ENDORPHIN_PERF_MONITORING === 'true';
    
    this.metrics = {
      startTime: Date.now(),
      peakMemoryMB: 0,
      avgMemoryMB: 0,
      peakCpuPercent: 0,
      avgCpuPercent: 0,
      peakBrowserHeapMB: 0,
      avgBrowserHeapMB: 0,
      peakDomNodes: 0,
      avgDomNodes: 0,
      testCount: 0,
      gcCount: 0,
      cleanupCount: 0,
      memoryOptimizerEnabled: false,
      samples: []
    };

    if (this.enabled) {
      this.startMonitoring();
      info('Performance monitoring enabled', {}, 'CIPerformance');
    }
  }

  private startMonitoring(): void {
    // Initialize CPU tracking
    this.lastCpuUsage = process.cpuUsage();
    
    // Sample performance every 10 seconds to reduce data volume
    this.monitoringInterval = setInterval(async () => {
      await this.collectPerformanceData();
    }, 10000);
    
    // Show console updates every 20 seconds
    this.consoleInterval = setInterval(() => {
      this.showConsoleUpdate();
    }, 20000);
  }

  private async collectPerformanceData(): Promise<void> {
    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / 1024 / 1024;
    
    // Calculate CPU usage (simplified approximation)
    let cpuPercent = 0;
    if (this.lastCpuUsage) {
      const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
      // Convert microseconds to percentage (approximate)
      cpuPercent = Math.min(((currentCpuUsage.user + currentCpuUsage.system) / 50000), 100); // Normalize to reasonable range
    }
    this.lastCpuUsage = process.cpuUsage();
    
    // Store snapshots
    this.memorySnapshots.push(memoryMB);
    this.cpuSnapshots.push(cpuPercent);
    
    // Create sample object
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      memoryMB: Math.round(memoryMB * 10) / 10,
      cpuPercent: Math.round(cpuPercent * 10) / 10
    };
    
    // Collect browser memory data if page is available
    if (this.currentPage) {
      try {
        const browserMemory = await this.collectBrowserMemoryData();
        if (browserMemory) {
          sample.browserHeapUsedMB = browserMemory.heapUsedMB;
          sample.browserHeapTotalMB = browserMemory.heapTotalMB;
          sample.domNodes = browserMemory.domNodes;
          sample.domDocuments = browserMemory.domDocuments;
          
          // Update browser memory tracking
          this.recordBrowserMemory(
            browserMemory.heapUsedMB,
            browserMemory.heapTotalMB,
            browserMemory.domNodes,
            browserMemory.domDocuments
          );
        }
      } catch {
        // Silently continue if browser memory collection fails
        // Skip logging debug info as it's expected to sometimes fail
      }
    }
    
    // Store sample for report
    this.metrics.samples.push(sample);
    
    // Update peaks
    if (memoryMB > this.metrics.peakMemoryMB) {
      this.metrics.peakMemoryMB = memoryMB;
    }
    if (cpuPercent > this.metrics.peakCpuPercent) {
      this.metrics.peakCpuPercent = cpuPercent;
    }
    
    // Keep only last 20 snapshots (last 1.5 minutes)
    if (this.memorySnapshots.length > 20) {
      this.memorySnapshots.shift();
      this.cpuSnapshots.shift();
    }
    
    // Calculate averages
    this.metrics.avgMemoryMB = this.memorySnapshots.reduce((sum, mem) => sum + mem, 0) / this.memorySnapshots.length;
    this.metrics.avgCpuPercent = this.cpuSnapshots.reduce((sum, cpu) => sum + cpu, 0) / this.cpuSnapshots.length;
  }

  private showConsoleUpdate(): void {
    if (!this.enabled) return;
    
    const memoryMB = Math.round(this.metrics.avgMemoryMB);
    const cpuPercent = Math.round(this.metrics.avgCpuPercent);
    const browserHeapMB = Math.round(this.metrics.avgBrowserHeapMB);
    const domNodes = Math.round(this.metrics.avgDomNodes);
    
    let consoleMsg = `Memory: ${memoryMB}MB | CPU: ${cpuPercent}%`;
    
    if (browserHeapMB > 0) {
      consoleMsg += ` | Browser Heap: ${browserHeapMB}MB`;
    }
    
    if (domNodes > 0) {
      consoleMsg += ` | DOM Nodes: ${domNodes}`;
    }
    
    info(consoleMsg, {
      memoryMB,
      cpuPercent,
      browserHeapMB,
      domNodes
    }, 'Performance');
  }

  recordTestStart(): void {
    if (this.enabled) {
      this.metrics.testCount++;
    }
  }

  setCurrentPage(page: any): void {
    if (this.enabled) {
      this.currentPage = page;
    }
  }

  private async collectBrowserMemoryData(): Promise<{
    heapUsedMB: number;
    heapTotalMB: number;
    domNodes: number;
    domDocuments: number;
  } | null> {
    if (!this.currentPage) {
      return null;
    }

    try {
      // Use Chrome DevTools Protocol to get heap usage
      const heapUsage = await this.currentPage.evaluate(() => {
        // @ts-ignore - performance.memory is Chrome-specific
        if (performance.memory) {
          return {
            // @ts-ignore
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            // @ts-ignore
            totalJSHeapSize: performance.memory.totalJSHeapSize
          };
        }
        return null;
      });

      // Get DOM nodes count
      const domStats = await this.currentPage.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const documents = document.querySelectorAll('iframe').length + 1; // Main document + iframes
        return {
          nodeCount: allElements.length,
          documentCount: documents
        };
      });

      if (!heapUsage) {
        return null;
      }

      return {
        heapUsedMB: Math.round((heapUsage.usedJSHeapSize / 1024 / 1024) * 10) / 10,
        heapTotalMB: Math.round((heapUsage.totalJSHeapSize / 1024 / 1024) * 10) / 10,
        domNodes: domStats.nodeCount,
        domDocuments: domStats.documentCount
      };
    } catch {
      // Skip logging debug info as it's expected to sometimes fail
      return null;
    }
  }

  recordBrowserMemory(heapUsedMB: number, heapTotalMB: number, domNodes: number, domDocuments: number): void {
    if (this.enabled) {
      // Store snapshots for averaging
      this.browserHeapSnapshots.push(heapUsedMB);
      this.domNodesSnapshots.push(domNodes);

      // Update peaks
      if (heapUsedMB > this.metrics.peakBrowserHeapMB) {
        this.metrics.peakBrowserHeapMB = heapUsedMB;
      }
      if (domNodes > this.metrics.peakDomNodes) {
        this.metrics.peakDomNodes = domNodes;
      }

      // Keep only last 20 snapshots
      if (this.browserHeapSnapshots.length > 20) {
        this.browserHeapSnapshots.shift();
        this.domNodesSnapshots.shift();
      }

      // Calculate averages
      this.metrics.avgBrowserHeapMB = this.browserHeapSnapshots.reduce((sum, heap) => sum + heap, 0) / this.browserHeapSnapshots.length;
      this.metrics.avgDomNodes = this.domNodesSnapshots.reduce((sum, nodes) => sum + nodes, 0) / this.domNodesSnapshots.length;

      // Update the latest sample with browser memory data if it exists
      if (this.metrics.samples.length > 0) {
        const latestSample = this.metrics.samples[this.metrics.samples.length - 1];
        latestSample.browserHeapUsedMB = Math.round(heapUsedMB * 10) / 10;
        latestSample.browserHeapTotalMB = Math.round(heapTotalMB * 10) / 10;
        latestSample.domNodes = domNodes;
        latestSample.domDocuments = domDocuments;
      }
    }
  }

  recordGC(): void {
    if (this.enabled) {
      this.metrics.gcCount++;
      info(`GC triggered (${this.metrics.gcCount} total)`, { gcCount: this.metrics.gcCount }, 'Performance');
    }
  }

  recordCleanup(): void {
    if (this.enabled) {
      this.metrics.cleanupCount++;
    }
  }

  getMetrics(): CIPerformanceMetrics {
    return {
      ...this.metrics,
      endTime: Date.now()
    };
  }

  generateSummary(): string {
    if (!this.enabled) {
      return 'Performance monitoring disabled';
    }

    const duration = (Date.now() - this.metrics.startTime) / 1000;
    
    let summary = `
📊 Performance Summary:
⏱️  Duration: ${duration.toFixed(1)}s
🧪 Tests: ${this.metrics.testCount}
💾 Peak Memory: ${this.metrics.peakMemoryMB.toFixed(1)}MB
📈 Avg Memory: ${this.metrics.avgMemoryMB.toFixed(1)}MB
⚡ Peak CPU: ${this.metrics.peakCpuPercent.toFixed(1)}%
🔄 Avg CPU: ${this.metrics.avgCpuPercent.toFixed(1)}%`;

    // Add browser memory stats if available
    if (this.metrics.peakBrowserHeapMB > 0) {
      summary += `
🌐 Peak Browser Heap: ${this.metrics.peakBrowserHeapMB.toFixed(1)}MB
📊 Avg Browser Heap: ${this.metrics.avgBrowserHeapMB.toFixed(1)}MB`;
    }

    if (this.metrics.peakDomNodes > 0) {
      summary += `
📄 Peak DOM Nodes: ${this.metrics.peakDomNodes}
📋 Avg DOM Nodes: ${Math.round(this.metrics.avgDomNodes)}`;
    }

    summary += `
🗑️  GC Triggers: ${this.metrics.gcCount}
🧹 Cleanups: ${this.metrics.cleanupCount}`;

    return summary.trim();
  }

  async generateHtmlReport(outputDir: string = 'test-results'): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const { PerformanceReporter } = await import('../reporters/performance-reporter.js');
      const reporter = new PerformanceReporter();
      return await reporter.generateReport(this.getMetrics(), outputDir);
    } catch (error) {
      logError('Failed to generate performance report', error instanceof Error ? error : undefined, { message: String(error) }, 'Performance');
      return null;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.consoleInterval) {
      clearInterval(this.consoleInterval);
      this.consoleInterval = null;
    }

    if (this.enabled && !this.summaryPrinted) {
      info(this.generateSummary(), {}, 'Performance');
      this.summaryPrinted = true;
      // Note: HTML report generation is now handled by TestRunner to ensure it completes
    }

    this.isDisposed = true;
  }
}

// Global instance for easy access
export const ciPerformanceMonitor = new CIPerformanceMonitor();

// Cleanup on process exit
process.on('exit', () => {
  ciPerformanceMonitor.dispose();
});

process.on('SIGINT', () => {
  ciPerformanceMonitor.dispose();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ciPerformanceMonitor.dispose();
  process.exit(0);
});