/**
 * Plugin Registry
 * Manages plugin installation, configuration, and execution
 */

import {
  Plugin,
  PluginHooks,
} from './types';
import { kv } from '@vercel/kv';

class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private enabledPlugins: Set<string> = new Set();

  /**
   * Load installed plugins from storage
   */
  async loadPlugins(): Promise<void> {
    try {
      const pluginIds = (await kv.smembers('plugins:installed')) as string[];

      for (const id of pluginIds) {
        const pluginData = await kv.get<string>(`plugin:${id}`);
        if (pluginData) {
          const plugin: Plugin = JSON.parse(pluginData);
          this.plugins.set(id, plugin);

          if (plugin.isEnabled) {
            this.enabledPlugins.add(id);
          }
        }
      }

      console.log(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      console.error('Error loading plugins:', error);
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(plugin: Plugin): Promise<void> {
    // Validate dependencies
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Missing dependency: ${depId}`);
        }
      }
    }

    // Call install hook if defined
    if (plugin.hooks.onPluginInstall) {
      await plugin.hooks.onPluginInstall();
    }

    // Store plugin
    this.plugins.set(plugin.id, plugin);
    await kv.set(`plugin:${plugin.id}`, JSON.stringify(plugin));
    await kv.sadd('plugins:installed', plugin.id);

    console.log(`Plugin installed: ${plugin.name}`);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Check if other plugins depend on this one
    for (const [, p] of this.plugins) {
      if (p.dependencies?.includes(pluginId)) {
        throw new Error(`Cannot uninstall: ${p.name} depends on this plugin`);
      }
    }

    // Call uninstall hook if defined
    if (plugin.hooks.onPluginUninstall) {
      await plugin.hooks.onPluginUninstall();
    }

    // Remove plugin
    this.plugins.delete(pluginId);
    this.enabledPlugins.delete(pluginId);
    await kv.del(`plugin:${pluginId}`);
    await kv.srem('plugins:installed', pluginId);

    console.log(`Plugin uninstalled: ${plugin.name}`);
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Call enable hook if defined
    if (plugin.hooks.onPluginEnable) {
      await plugin.hooks.onPluginEnable();
    }

    plugin.isEnabled = true;
    this.enabledPlugins.add(pluginId);

    await kv.set(`plugin:${pluginId}`, JSON.stringify(plugin));

    console.log(`Plugin enabled: ${plugin.name}`);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Call disable hook if defined
    if (plugin.hooks.onPluginDisable) {
      await plugin.hooks.onPluginDisable();
    }

    plugin.isEnabled = false;
    this.enabledPlugins.delete(pluginId);

    await kv.set(`plugin:${pluginId}`, JSON.stringify(plugin));

    console.log(`Plugin disabled: ${plugin.name}`);
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    plugin.config = config;

    // Call config update hook if defined
    if (plugin.hooks.onConfigUpdate) {
      await plugin.hooks.onConfigUpdate(config);
    }

    await kv.set(`plugin:${pluginId}`, JSON.stringify(plugin));

    console.log(`Plugin config updated: ${plugin.name}`);
  }

  /**
   * Execute a hook across all enabled plugins
   */
  async executeHook<T extends keyof PluginHooks>(
    hookName: T,
    context: Parameters<NonNullable<PluginHooks[T]>>[0]
  ): Promise<typeof context> {
    let updatedContext = context;

    for (const pluginId of this.enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) continue;

      const hook = plugin.hooks[hookName];
      if (!hook) continue;

      try {
        const startTime = Date.now();

        // @ts-expect-error - TypeScript can't infer hook signature properly
        updatedContext = await hook(updatedContext);

        const executionTime = Date.now() - startTime;

        // Log slow plugins
        if (executionTime > 1000) {
          console.warn(
            `Plugin ${plugin.name} hook ${hookName} took ${executionTime}ms`
          );
        }
      } catch (error) {
        console.error(
          `Error executing ${hookName} hook in plugin ${plugin.name}:`,
          error
        );
        // Continue with other plugins even if one fails
      }
    }

    return updatedContext;
  }

  /**
   * Get all installed plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.enabledPlugins)
      .map(id => this.plugins.get(id))
      .filter((p): p is Plugin => p !== undefined);
  }

  /**
   * Check if a plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

// Auto-load plugins on import
if (typeof window === 'undefined') {
  // Only load on server side
  pluginRegistry.loadPlugins().catch(console.error);
}
