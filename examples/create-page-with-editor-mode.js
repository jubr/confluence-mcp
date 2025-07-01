#!/usr/bin/env node

/**
 * Example script demonstrating EditorMode functionality
 * 
 * This script shows how to create Confluence pages with different editor modes:
 * - v2 (new editor) - default
 * - v1 (legacy editor) 
 * - auto (let Confluence decide)
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
  console.error('- CONFLUENCE_SPACE_KEY (optional, defaults to TEST)');
  process.exit(1);
}

async function demonstrateEditorModes() {
  const api = new ConfluenceApiService(baseUrl, email, apiToken);
  
  console.log('🚀 Demonstrating Confluence Editor Mode functionality\n');

  try {
    // Example 1: Create page with new editor (default behavior)
    console.log('📝 Creating page with new editor (v2 - default)...');
    const newEditorPage = await api.createPage(
      spaceKey,
      'Page with New Editor',
      '<p>This page was created with the <strong>new editor (v2)</strong>.</p><p>It supports modern editing features and provides a better user experience.</p>'
    );
    console.log(`✅ Created: ${newEditorPage.title} (ID: ${newEditorPage.id})`);
    console.log(`   URL: ${newEditorPage.links.webui}\n`);

    // Example 2: Create page with legacy editor  
    console.log('📝 Creating page with legacy editor (v1)...');
    const legacyEditorPage = await api.createPage(
      spaceKey,
      'Page with Legacy Editor',
      '<p>This page was created with the <strong>legacy editor (v1)</strong>.</p><p>This mode is useful for compatibility with older content or specific requirements.</p>',
      undefined,
      'v1'
    );
    console.log(`✅ Created: ${legacyEditorPage.title} (ID: ${legacyEditorPage.id})`);
    console.log(`   URL: ${legacyEditorPage.links.webui}\n`);

    // Example 3: Create page with auto mode
    console.log('📝 Creating page with auto editor mode...');
    const autoModePage = await api.createPage(
      spaceKey,
      'Page with Auto Editor Mode',
      '<p>This page was created with <strong>auto mode</strong>.</p><p>Confluence will analyze the content and choose the appropriate editor automatically.</p>',
      undefined,
      'auto'
    );
    console.log(`✅ Created: ${autoModePage.title} (ID: ${autoModePage.id})`);
    console.log(`   URL: ${autoModePage.links.webui}\n`);

    // Example 4: Create page with complex content that might trigger legacy editor
    console.log('📝 Creating page with complex content (new editor forced)...');
    const complexContentPage = await api.createPage(
      spaceKey,
      'Complex Content with New Editor',
      `<p>This page contains complex content but forces the new editor:</p>
      <table>
        <tr>
          <th>Feature</th>
          <th>New Editor</th>
          <th>Legacy Editor</th>
        </tr>
        <tr>
          <td>Modern UI</td>
          <td>✅</td>
          <td>❌</td>
        </tr>
        <tr>
          <td>Better Performance</td>
          <td>✅</td>
          <td>❌</td>
        </tr>
      </table>
      <p>Even with tables and complex markup, the new editor is used when explicitly specified.</p>`,
      undefined,
      'v2'
    );
    console.log(`✅ Created: ${complexContentPage.title} (ID: ${complexContentPage.id})`);
    console.log(`   URL: ${complexContentPage.links.webui}\n`);

    console.log('🎉 All examples completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- New Editor (v2): ${newEditorPage.title}`);
    console.log(`- Legacy Editor (v1): ${legacyEditorPage.title}`);
    console.log(`- Auto Mode: ${autoModePage.title}`);
    console.log(`- Complex Content (v2): ${complexContentPage.title}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the demonstration
demonstrateEditorModes(); 