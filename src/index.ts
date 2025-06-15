import 'module-alias/register';
import dotenv from 'dotenv';
import App from './app';

// Load environment variables
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

// Get port from environment variables or use default
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Create and start the server
const app = new App();

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle process termination
const shutdown = (signal: string) => {
  console.error(`Received ${signal}. Shutting down gracefully...`);
  // Add any cleanup tasks here
  process.exit(0);
};

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
app.start(PORT);
