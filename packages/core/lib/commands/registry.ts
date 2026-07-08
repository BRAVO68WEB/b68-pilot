import type {
  CommandDefinition,
  CommandHandler,
  CommandResult,
  RegisteredCommand,
  CommandContext,
} from '@pilot/plugin-sdk'

/**
 * Dynamic command registry — replaces the hardcoded if/else chain in executor.
 * Built-in commands register at startup; plugins register on load.
 */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>()
  private readonly aliases = new Map<string, string>()

  /** Register a built-in command */
  registerBuiltin(name: string, handler: CommandHandler, opts?: { aliases?: string[]; description?: string }): void {
    const def: CommandDefinition = {
      name,
      description: opts?.description ?? name,
      usage: name,
      aliases: opts?.aliases,
      handler,
    }
    this.commands.set(name, { definition: def, pluginName: '__builtin__', enabled: true })
    this.registerAliases(name, opts?.aliases)
  }

  /** Register commands from a plugin */
  registerPluginCommands(pluginName: string, commands: CommandDefinition[]): void {
    for (const def of commands) {
      this.commands.set(def.name, { definition: def, pluginName, enabled: true })
      this.registerAliases(def.name, def.aliases)
    }
  }

  /** Unregister all commands from a plugin */
  unregisterPlugin(pluginName: string): void {
    for (const [name, cmd] of this.commands) {
      if (cmd.pluginName === pluginName) {
        this.commands.delete(name)
        // Clean up aliases pointing to this command
        for (const [alias, target] of this.aliases) {
          if (target === name) this.aliases.delete(alias)
        }
      }
    }
  }

  /** Dispatch a command by name (or alias) */
  async dispatch(
    name: string,
    args: string[],
    ctx: CommandContext
  ): Promise<CommandResult | null> {
    const resolved = this.resolve(name)
    if (!resolved) return null

    const cmd = this.commands.get(resolved)
    if (!cmd || !cmd.enabled) return null

    return cmd.definition.handler(args, ctx)
  }

  /** Resolve a name or alias to the canonical command name */
  resolve(name: string): string | null {
    if (this.commands.has(name)) return name
    return this.aliases.get(name) ?? null
  }

  /** Check if a command exists */
  has(name: string): boolean {
    return this.resolve(name) !== null
  }

  /** List all registered commands */
  list(): Array<{ name: string; description: string; usage: string; pluginName: string; enabled: boolean }> {
    return Array.from(this.commands.values()).map((cmd) => ({
      name: cmd.definition.name,
      description: cmd.definition.description,
      usage: cmd.definition.usage,
      pluginName: cmd.pluginName,
      enabled: cmd.enabled,
    }))
  }

  /** Enable/disable a command */
  setEnabled(name: string, enabled: boolean): void {
    const cmd = this.commands.get(name)
    if (cmd) cmd.enabled = enabled
  }

  private registerAliases(name: string, aliases?: string[]): void {
    if (!aliases) return
    for (const alias of aliases) {
      this.aliases.set(alias, name)
    }
  }
}
