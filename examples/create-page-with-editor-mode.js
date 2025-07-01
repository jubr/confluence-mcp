#!/usr/bin/env node

/**
 * Example script demonstrating EditorMode functionality and file attachment options
 * 
 * This script shows how to:
 * - Create Confluence pages with different editor modes (v2, v1, auto)
 * - Add attachments using base64 content or file paths
 */

import { ConfluenceApiService } from '../src/services/confluence-api.js';

// Configuration from environment variables
const baseUrl = process.env.CONFLUENCE_BASE_URL;
const email = process.env.CONFLUENCE_EMAIL;
const apiToken = process.env.CONFLUENCE_API_TOKEN;
const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'TEST';

if (!baseUrl || !email || !apiToken) {
  console.error('Missing required environment variables:');
  console.error('- CONFLUENCE_BASE_URL');
  console.error('- CONFLUENCE_EMAIL');
  console.error('- CONFLUENCE_API_TOKEN');
  console.error('- CONFLUENCE_SPACE_KEY (optional, defaults to "TEST")');
  process.exit(1);
}

const api = new ConfluenceApiService(baseUrl, email, apiToken);

async function demonstrateEditorModes() {
  try {
    console.log('🚀 Creating pages with different editor modes...\n');

    // Create a page with v2 editor (default)
    console.log('📄 Creating page with v2 editor (new Confluence editor)...');
    const v2Page = await api.createPage(
      spaceKey,
      'Demo Page - New Editor',
      '<p>This page was created with the <strong>new Confluence editor (v2)</strong>.</p>',
      undefined, // no parent
      'v2'
    );
    console.log(`✅ Created: ${v2Page.links.webui}`);

    // Create a page with v1 editor (legacy)
    console.log('\n📄 Creating page with v1 editor (legacy editor)...');
    const v1Page = await api.createPage(
      spaceKey,
      'Demo Page - Legacy Editor',
      '<p>This page was created with the <strong>legacy Confluence editor (v1)</strong>.</p>',
      undefined,
      'v1'
    );
    console.log(`✅ Created: ${v1Page.links.webui}`);

    // Create a page with auto mode (let Confluence decide)
    console.log('\n📄 Creating page with auto editor mode...');
    const autoPage = await api.createPage(
      spaceKey,
      'Demo Page - Auto Mode',
      '<p>This page was created with <strong>auto editor mode</strong> (Confluence decides).</p>',
      undefined,
      'auto'
    );
    console.log(`✅ Created: ${autoPage.links.webui}`);

    console.log('\n🎯 All pages created successfully!');
    console.log('Note: The editor mode affects which Confluence editor users will see when editing these pages.');

    return { v2Page, v1Page, autoPage };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function demonstrateAttachments(pageId) {
  try {
    console.log('\n📎 Demonstrating attachment functionality...\n');

    // Example 1: Create a simple text file and attach using Buffer (simulating base64)
    console.log('📄 Creating attachment from buffer content...');
    const textContent = 'This is a sample text file created programmatically.';
    const textBuffer = Buffer.from(textContent, 'utf-8');
    
    const attachment1 = await api.addAttachment(
      pageId,
      textBuffer,
      'sample-text.txt',
      'Created from buffer content'
    );
    console.log(`✅ Attached: ${attachment1.title}`);

    // Example 2: If you have a file on disk, you could use it like this:
    // Note: This is how you would use the fileContentFromPath parameter via MCP
    console.log('\n💡 File path attachment example:');
    console.log('To attach a file from disk via MCP, you would use:');
    console.log(JSON.stringify({
      pageId: pageId,
      filename: 'my-document.pdf',
      fileContentFromPath: '/path/to/your/document.pdf',
      comment: 'Uploaded from local file system'
    }, null, 2));

    console.log('\n💡 Base64 attachment example:');
    console.log('To attach using base64 content via MCP, you would use:');
    console.log(JSON.stringify({
      pageId: pageId,
      filename: 'my-document.pdf', 
      fileContentBase64: 'JVBERi0xLjQK...(base64 content)',
      comment: 'Uploaded as base64 encoded content'
    }, null, 2));

    console.log('\n🎯 Attachment examples completed!');
  } catch (error) {
    console.error('❌ Error with attachments:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Demonstrate editor modes
    const pages = await demonstrateEditorModes();
    
    // Demonstrate attachments using the v2 page
    await demonstrateAttachments(pages.v2Page.id);

    console.log('\n🎉 All demonstrations completed successfully!');
    console.log('\nKey takeaways:');
    console.log('- v2 editor mode creates pages optimized for the new Confluence editor');
    console.log('- v1 editor mode creates pages for the legacy editor'); 
    console.log('- auto mode lets Confluence decide which editor to use');
    console.log('- fileContentFromPath simplifies file attachments from disk');
    console.log('- fileContentBase64 allows attaching in-memory content');
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 