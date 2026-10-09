/**
 * Browser configuration and browser-related types
 */

export interface BrowserConfig {
  type?: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: ViewportSize;
  timeout: number;
  slowMo?: number;
  devtools?: boolean;
  recordVideo?: boolean;
  recordHar?: boolean;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface BrowserTools {
  navigate: (params: NavigateParams) => Promise<string>;
  click: (params: ClickParams) => Promise<string>;
  fill: (params: FillParams) => Promise<string>;
  screenshot: (params?: ScreenshotParams) => Promise<string>;
}

export interface NavigateParams {
  url: string;
}

export interface ClickParams {
  selector: string;
  strategy?: 'text' | 'css' | 'role';
}

export interface FillParams {
  selector: string;
  text: string;
}

export interface ScreenshotParams {
  filename?: string;
}

export interface Screenshot {
  filename: string;
  filepath: string;
  timestamp: string;
  description: string;
  stepNumber: number;
}
