/**
 * Individual Plugin Actions API
 * Enable, disable, and uninstall plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { Permission } from '@/lib/auth/rbac';
import { pluginRegistry } from '@/lib/plugins/registry';

/**
 * GET /api/admin/plugins/[id]
 * Get plugin details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_READ);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    const plugin = pluginRegistry.getPlugin(id);

    if (!plugin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Plugin not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plugin,
    });
  } catch (error) {
    console.error('[Plugins] Error getting plugin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get plugin',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plugins/[id]?action=enable|disable
 * Enable or disable a plugin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action || !['enable', 'disable'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "enable" or "disable"',
        },
        { status: 400 }
      );
    }

    if (action === 'enable') {
      await pluginRegistry.enablePlugin(id);
    } else {
      await pluginRegistry.disablePlugin(id);
    }

    return NextResponse.json({
      success: true,
      message: `Plugin ${action}d successfully`,
    });
  } catch (error) {
    console.error('[Plugins] Error toggling plugin:', error);
    const actionLabel = new URL(request.url).searchParams.get('action') ?? 'update';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to ${actionLabel} plugin`,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/plugins/[id]
 * Uninstall a plugin
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(Permission.SETTINGS_UPDATE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    await pluginRegistry.uninstallPlugin(id);

    return NextResponse.json({
      success: true,
      message: 'Plugin uninstalled successfully',
    });
  } catch (error) {
    console.error('[Plugins] Error uninstalling plugin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to uninstall plugin',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
