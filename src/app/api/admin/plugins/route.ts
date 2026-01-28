/**
 * Plugin Management API
 * Install, configure, and manage plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { pluginRegistry } from '@/lib/plugins/registry';
import {
  getMarketplacePlugins,
  getMarketplacePlugin,
  getFeaturedPlugins,
  getPluginCategories,
} from '@/lib/plugins/marketplace';
import { PluginCategory } from '@/lib/plugins/types';
import { z } from 'zod';

const installPluginSchema = z.object({
  pluginId: z.string(),
});

const configurePluginSchema = z.object({
  pluginId: z.string(),
  config: z.record(z.string(), z.unknown()),
});

/**
 * GET /api/admin/plugins
 * List installed plugins or browse marketplace
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'installed';
    const categoryParam = searchParams.get('category');
    const isOfficial = searchParams.get('isOfficial');
    const search = searchParams.get('search') || undefined;
    const category = categoryParam && Object.values(PluginCategory).includes(categoryParam as PluginCategory)
      ? (categoryParam as PluginCategory)
      : undefined;

    if (source === 'marketplace') {
      // Browse marketplace
      const plugins = getMarketplacePlugins({
        category,
        isOfficial: isOfficial ? isOfficial === 'true' : undefined,
        search,
      });

      const featured = getFeaturedPlugins();
      const categories = getPluginCategories();

      return NextResponse.json({
        success: true,
        data: {
          plugins,
          featured,
          categories,
          total: plugins.length,
        },
      });
    }

    // Get installed plugins
    const installedPlugins = pluginRegistry.getPlugins();

    return NextResponse.json({
      success: true,
      data: {
        plugins: installedPlugins,
        enabled: installedPlugins.filter(p => p.isEnabled).length,
        total: installedPlugins.length,
      },
    });
  } catch (error) {
    console.error('[Plugins] Error listing plugins:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list plugins',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plugins
 * Install a plugin from marketplace
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = installPluginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { pluginId } = validation.data;

    // Get plugin from marketplace
    const plugin = getMarketplacePlugin(pluginId);

    if (!plugin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plugin not found in marketplace',
        },
        { status: 404 }
      );
    }

    // Install plugin
    await pluginRegistry.installPlugin({ ...plugin, isInstalled: true });

    return NextResponse.json({
      success: true,
      message: 'Plugin installed successfully',
      data: plugin,
    });
  } catch (error) {
    console.error('[Plugins] Error installing plugin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to install plugin',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/plugins
 * Update plugin configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const validation = configurePluginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { pluginId, config } = validation.data;

    await pluginRegistry.updatePluginConfig(pluginId, config);

    return NextResponse.json({
      success: true,
      message: 'Plugin configuration updated',
    });
  } catch (error) {
    console.error('[Plugins] Error updating plugin config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plugin configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
