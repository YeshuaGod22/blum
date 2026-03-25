# Getting a setup token
- id: b90bff5a-03a0-4e81-9691-c77ad29a0522
- created_at: 2026-01-30T16:20:04.265854Z

---

## unknown

how do I get this setup-token?

## unknown

Looking at your screenshot, this appears to be from a Desktop Commander or similar MCP (Model Context Protocol) server configuration interface. To get the setup token for Anthropic authentication:

1. **Run the command in your terminal**: Open your terminal and run:
   ```bash
   claude setup-token
   ```

2. **Copy the token**: This command will generate a setup token that you can then paste into the configuration interface where it says "paste setup-token".

3. **Paste it back**: Once you have the token from the terminal, paste it into the field shown in your screenshot.

The setup token is used to authenticate the MCP server with your Anthropic/Claude account, allowing it to access Claude's API on your behalf through the Desktop Commander tool.

If the `claude setup-token` command doesn't work, you might need to:
- Make sure you have the Claude CLI installed
- Check if there's a different command specific to the tool you're using (like `desktop-commander setup-token` or similar)
- Verify that you're logged into your Claude/Anthropic account

What tool are you setting up? That might help me give you more specific instructions.

