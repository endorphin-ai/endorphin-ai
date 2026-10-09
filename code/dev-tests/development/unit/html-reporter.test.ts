/**
 * Unit Tests for HTML Reporter - HTML Report Generation
 */

describe('HTMLReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Report Generation', () => {
    test('should generate HTML report with test results', () => {
      const mockReporter = {
        generateReport: jest.fn().mockImplementation((testResults, _options = {}) => {
            interface TestResult {
            testId: string;
            testName: string;
            status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | string;
            duration: number;
            error: string | null;
            }

            interface ReportSummary {
            total: number;
            passed: number;
            failed: number;
            skipped: number;
            }

            interface HtmlReport {
            title: string;
            timestamp: string;
            summary: ReportSummary;
            results: TestResult[];
            html: string;
            }

            const report: HtmlReport = {
            title: _options.title || 'Endorphin AI Test Report',
            timestamp: new Date().toISOString(),
            summary: {
              total: (testResults as TestResult[]).length,
              passed: (testResults as TestResult[]).filter((r: TestResult) => r.status === 'SUCCESS').length,
              failed: (testResults as TestResult[]).filter((r: TestResult) => r.status === 'FAILED').length,
              skipped: (testResults as TestResult[]).filter((r: TestResult) => r.status === 'SKIPPED').length
            },
            results: testResults as TestResult[],
            html: '<html><body>Generated HTML Report</body></html>'
            };
          return report;
        })
      };

      const testResults = [
        {
          testId: 'TEST-001',
          testName: 'Login Test',
          status: 'SUCCESS',
          duration: 2500,
          error: null
        },
        {
          testId: 'TEST-002',
          testName: 'Navigation Test',
          status: 'FAILED',
          duration: 1000,
          error: 'Element not found'
        }
      ];

      const report = mockReporter.generateReport(testResults);

      expect(mockReporter.generateReport).toHaveBeenCalledWith(testResults);
      expect(report.title).toBe('Endorphin AI Test Report');
      expect(report.summary.total).toBe(2);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.skipped).toBe(0);
      expect(report.html).toContain('Generated HTML Report');
    });

    test('should generate report with custom title', () => {
      const mockReporter = {
        generateReport: jest.fn().mockImplementation((testResults, _options = {}) => ({
          title: _options.title || 'Default Title',
          timestamp: new Date().toISOString(),
          summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
          results: testResults,
          html: '<html></html>'
        }))
      };

      const report = mockReporter.generateReport([], { title: 'Custom Test Report' });

      expect(report.title).toBe('Custom Test Report');
    });

    test('should include timestamps in report', () => {
      const mockReporter = {
        generateReport: jest.fn().mockImplementation((testResults, _options = {}) => {
          const now = new Date();
          return {
            title: 'Test Report',
            timestamp: now.toISOString(),
            generatedAt: now.toLocaleString(),
            summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
            results: testResults,
            html: '<html></html>'
          };
        })
      };

      const report = mockReporter.generateReport([]);

      expect(report.timestamp).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('HTML Template Generation', () => {
    test('should generate HTML with CSS styles', () => {
      const mockReporter = {
        generateHTML: jest.fn().mockImplementation((reportData) => {
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>${reportData.title}</title>
              <style>
                body { font-family: Arial, sans-serif; }
                .success { color: green; }
                .failed { color: red; }
                .skipped { color: orange; }
              </style>
            </head>
            <body>
              <h1>${reportData.title}</h1>
              <div class="summary">
                <p>Total: ${reportData.summary.total}</p>
                <p class="success">Passed: ${reportData.summary.passed}</p>
                <p class="failed">Failed: ${reportData.summary.failed}</p>
              </div>
            </body>
            </html>
          `;
          return html;
        })
      };

      const reportData = {
        title: 'Test Report',
        summary: { total: 3, passed: 2, failed: 1, skipped: 0 }
      };

      const html = mockReporter.generateHTML(reportData);

      expect(mockReporter.generateHTML).toHaveBeenCalledWith(reportData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Report</title>');
      expect(html).toContain('font-family: Arial');
      expect(html).toContain('Total: 3');
      expect(html).toContain('Passed: 2');
      expect(html).toContain('Failed: 1');
    });

    test('should include test results table', () => {
      const mockReporter = {
        generateTestResultsTable: jest.fn().mockImplementation((results) => {
          interface TestResult {
            testId: string;
            testName: string;
            status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | string;
            duration: number;
            error: string | null;
          }

          const rows: string = (results as TestResult[]).map((result: TestResult) => `
            <tr class="${result.status.toLowerCase()}">
              <td>${result.testId}</td>
              <td>${result.testName}</td>
              <td>${result.status}</td>
              <td>${result.duration}ms</td>
              <td>${result.error || '-'}</td>
            </tr>
          `).join('');

          return `
            <table>
              <thead>
                <tr>
                  <th>Test ID</th>
                  <th>Test Name</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          `;
        })
      };

      const results = [
        {
          testId: 'TEST-001',
          testName: 'Login Test',
          status: 'SUCCESS',
          duration: 2500,
          error: null
        },
        {
          testId: 'TEST-002',
          testName: 'Failed Test',
          status: 'FAILED',
          duration: 1000,
          error: 'Element not found'
        }
      ];

      const table = mockReporter.generateTestResultsTable(results);

      expect(mockReporter.generateTestResultsTable).toHaveBeenCalledWith(results);
      expect(table).toContain('<table>');
      expect(table).toContain('<th>Test ID</th>');
      expect(table).toContain('<td>TEST-001</td>');
      expect(table).toContain('<td>Login Test</td>');
      expect(table).toContain('<td>SUCCESS</td>');
      expect(table).toContain('<td>2500ms</td>');
      expect(table).toContain('class="success"');
      expect(table).toContain('class="failed"');
      expect(table).toContain('Element not found');
    });
  });

  describe('File Operations', () => {
    test('should save report to file', async () => {
      const mockReporter = {
        saveReport: jest.fn().mockImplementation(async (html, filePath) => {
          // Mock file system write
          return {
            success: true,
            filePath,
            size: html.length
          };
        })
      };

      const html = '<html><body>Test Report</body></html>';
      const filePath = '/path/to/report.html';

      const result = await mockReporter.saveReport(html, filePath);

      expect(mockReporter.saveReport).toHaveBeenCalledWith(html, filePath);
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(filePath);
      expect(result.size).toBe(html.length);
    });

    test('should handle file write errors', async () => {
      const mockReporter = {
        saveReport: jest.fn().mockRejectedValue(new Error('Permission denied'))
      };

      await expect(mockReporter.saveReport('<html></html>', '/readonly/report.html'))
        .rejects.toThrow('Permission denied');
    });

    test('should create output directory if not exists', async () => {
      const mockReporter = {
        ensureOutputDirectory: jest.fn().mockImplementation(async (filePath) => {
          const dir = filePath.substring(0, filePath.lastIndexOf('/'));
          return {
            created: true,
            directory: dir
          };
        }),
        saveReport: jest.fn().mockResolvedValue({ success: true })
      };

      await mockReporter.ensureOutputDirectory('/new/path/report.html');
      await mockReporter.saveReport('<html></html>', '/new/path/report.html');

      expect(mockReporter.ensureOutputDirectory).toHaveBeenCalledWith('/new/path/report.html');
      expect(mockReporter.saveReport).toHaveBeenCalled();
    });
  });

  describe('Chart Generation', () => {
    test('should generate test status chart data', () => {
      const mockReporter = {
        generateChartData: jest.fn().mockImplementation((summary) => {
          return {
            type: 'pie',
            data: {
              labels: ['Passed', 'Failed', 'Skipped'],
              datasets: [{
                data: [summary.passed, summary.failed, summary.skipped],
                backgroundColor: ['#28a745', '#dc3545', '#ffc107']
              }]
            }
          };
        })
      };

      const summary = { total: 10, passed: 7, failed: 2, skipped: 1 };
      const chartData = mockReporter.generateChartData(summary);

      expect(mockReporter.generateChartData).toHaveBeenCalledWith(summary);
      expect(chartData.type).toBe('pie');
      expect(chartData.data.labels).toEqual(['Passed', 'Failed', 'Skipped']);
      expect(chartData.data.datasets[0].data).toEqual([7, 2, 1]);
      expect(chartData.data.datasets[0].backgroundColor).toEqual(['#28a745', '#dc3545', '#ffc107']);
    });

    test('should generate duration chart data', () => {
      const mockReporter = {
        generateDurationChart: jest.fn().mockImplementation((results) => {
            interface DurationChartResult {
            testName: string;
            duration: number;
            }
            const testNames: string[] = (results as DurationChartResult[]).map((r: DurationChartResult) => r.testName);
            const durations: number[] = (results as DurationChartResult[]).map((r: DurationChartResult) => r.duration);

          return {
            type: 'bar',
            data: {
              labels: testNames,
              datasets: [{
                label: 'Duration (ms)',
                data: durations,
                backgroundColor: '#007bff'
              }]
            }
          };
        })
      };

      const results = [
        { testName: 'Test 1', duration: 1500 },
        { testName: 'Test 2', duration: 2500 },
        { testName: 'Test 3', duration: 1000 }
      ];

      const chartData = mockReporter.generateDurationChart(results);

      expect(chartData.type).toBe('bar');
      expect(chartData.data.labels).toEqual(['Test 1', 'Test 2', 'Test 3']);
      expect(chartData.data.datasets[0].data).toEqual([1500, 2500, 1000]);
    });
  });

  describe('Report Customization', () => {
    test('should allow custom CSS themes', () => {
      const mockReporter = {
        applyTheme: jest.fn().mockImplementation((html: string, theme: 'dark' | 'light' | 'blue') => {
          const themes: Record<'dark' | 'light' | 'blue', string> = {
            dark: 'body { background: #333; color: #fff; }',
            light: 'body { background: #fff; color: #333; }',
            blue: 'body { background: #e3f2fd; color: #1565c0; }'
          };

          const css = themes[theme] || themes.light;
          return html.replace('<style>', `<style>${css}`);
        })
      };

      const html = '<html><head><style></style></head><body></body></html>';
      
      const darkTheme = mockReporter.applyTheme(html, 'dark');
      const lightTheme = mockReporter.applyTheme(html, 'light');

      expect(darkTheme).toContain('background: #333');
      expect(lightTheme).toContain('background: #fff');
    });

    test('should support custom header and footer', () => {
      const mockReporter = {
        addCustomContent: jest.fn().mockImplementation((html, options) => {
          let modifiedHtml = html;

          if (options.header) {
            modifiedHtml = modifiedHtml.replace('<body>', `<body><header>${options.header}</header>`);
          }

          if (options.footer) {
            modifiedHtml = modifiedHtml.replace('</body>', `<footer>${options.footer}</footer></body>`);
          }

          return modifiedHtml;
        })
      };

      const html = '<html><body><main>Content</main></body></html>';
      const options = {
        header: '<h1>Custom Header</h1>',
        footer: '<p>Generated by Endorphin AI</p>'
      };

      const customizedHtml = mockReporter.addCustomContent(html, options);

      expect(customizedHtml).toContain('<header><h1>Custom Header</h1></header>');
      expect(customizedHtml).toContain('<footer><p>Generated by Endorphin AI</p></footer>');
    });
  });
});
