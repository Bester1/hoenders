import { chromium } from 'playwright';
import { createServer } from 'http';

const PORT = process.env.PORT || 3001;

// Simple MCP-like server for browser automation
class PlaywrightServer {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    console.log('🚀 Starting Playwright Server...');
    
    try {
      this.browser = await chromium.launch({
        headless: false // Show browser for testing
      });
      this.context = await this.browser.newContext();
      console.log('✅ Browser initialized');
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      throw error;
    }
  }

  async handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      switch (path) {
        case '/status':
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'running', browser: 'chromium', page: this.page ? 'active' : 'none' }));
          break;

        case '/new-page':
          if (this.page) await this.page.close();
          this.page = await this.context.newPage();
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'New page created', url: this.page.url() }));
          break;

        case '/navigate':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const targetUrl = data.url || 'https://example.com';
                
                if (!this.page) {
                  this.page = await this.context.newPage();
                }
                
                await this.page.goto(targetUrl);
                const title = await this.page.title();
                
                res.writeHead(200);
                res.end(JSON.stringify({ 
                  message: 'Navigation successful', 
                  url: targetUrl, 
                  title: title 
                }));
              } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/screenshot':
          if (!this.page) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active page' }));
            return;
          }
          
          const screenshot = await this.page.screenshot({ encoding: 'base64' });
          res.writeHead(200);
          res.end(JSON.stringify({ screenshot: screenshot }));
          break;

        case '/click':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const selector = data.selector;
                
                if (!this.page) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ error: 'No active page' }));
                  return;
                }
                
                await this.page.click(selector);
                res.writeHead(200);
                res.end(JSON.stringify({ message: `Clicked element: ${selector}` }));
              } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/type':
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const selector = data.selector;
                const text = data.text;
                
                if (!this.page) {
                  res.writeHead(400);
                  res.end(JSON.stringify({ error: 'No active page' }));
                  return;
                }
                
                await this.page.fill(selector, text);
                res.writeHead(200);
                res.end(JSON.stringify({ message: `Typed text into: ${selector}` }));
              } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/close':
          if (this.page) {
            await this.page.close();
            this.page = null;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'Page closed' }));
          break;

        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    } catch (error) {
      console.error('❌ Server error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down Playwright Server...');
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    console.log('✅ Server shutdown complete');
  }
}

// Create and start server
const server = new PlaywrightServer();
const httpServer = createServer((req, res) => server.handleRequest(req, res));

async function startServer() {
  try {
    await server.initialize();
    
    httpServer.listen(PORT, () => {
      console.log(`🌐 Playwright Server running on http://localhost:${PORT}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  GET  /status       - Check server status');
      console.log('  POST /new-page     - Create new browser page');
      console.log('  POST /navigate     - Navigate to URL ({"url": "https://example.com"})');
      console.log('  GET  /screenshot   - Take screenshot (returns base64)');
      console.log('  POST /click        - Click element ({"selector": "button"})');
      console.log('  POST /type         - Type text ({"selector": "input", "text": "hello"})');
      console.log('  POST /close        - Close current page');
      console.log('');
      console.log('Example usage:');
      console.log(`  curl -X POST http://localhost:${PORT}/navigate -H "Content-Type: application/json" -d '{"url": "https://google.com"}'`);
      console.log(`  curl http://localhost:${PORT}/screenshot`);
      console.log('');
      console.log('Press Ctrl+C to stop the server');
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      httpServer.close(() => {
        console.log('✅ HTTP server closed');
      });
      await server.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();