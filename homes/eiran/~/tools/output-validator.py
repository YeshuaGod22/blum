"""
output-validator.py

Post-inference middleware for Blum agents.
Checks that every agent output contains either:
  (a) a properly addressed <message to="name@room">...</message> tag, or
  (b) a tool call

If neither is present, returns an alert to inject back to the agent.

Usage:
    from output_validator import handle_output

    result = handle_output(agent_name, room_name, raw_output)
    if not result['valid']:
        # inject result['alert'] back to agent as system message
        pass
"""

import re
import logging

logger = logging.getLogger(__name__)

# Matches: <message to="name@room"> or <message to='name@room'>
MESSAGE_TAG_PATTERN = re.compile(
    r'<message\s+to=["\'][\w.\-]+@[\w.\-]+["\']',
    re.IGNORECASE
)

# Matches tool call patterns from Anthropic's API and common variants
TOOL_CALL_PATTERN = re.compile(
    r'<tool_use>|<function_calls>|"type"\s*:\s*"tool_use"|<invoke\s+name=',
    re.IGNORECASE
)


def validate_output(agent_name: str, room_name: str, output: str) -> dict:
    """
    Validate agent output.

    Returns:
        dict with keys:
          - valid (bool)
          - reason (str | None): explanation if invalid
    """
    if not output or not output.strip():
        return {
            'valid': False,
            'reason': f'Empty output from {agent_name} — no message tag or tool call found.'
        }

    has_message_tag = bool(MESSAGE_TAG_PATTERN.search(output))
    has_tool_call = bool(TOOL_CALL_PATTERN.search(output))

    if has_message_tag or has_tool_call:
        return {'valid': True, 'reason': None}

    return {
        'valid': False,
        'reason': (
            f'Output from {agent_name} in {room_name} contains neither '
            f'a valid <message to="name@room"> tag nor a tool call. '
            f'Output will not be delivered.'
        )
    }


def build_alert_message(agent_name: str, room_name: str) -> str:
    """
    Build a system alert to inject back to the agent when output is invalid.
    """
    return (
        f'[SYSTEM ALERT → {agent_name}] Your last output was not delivered. '
        f'It contained no addressed message tag and no tool call.\n\n'
        f'To send a message: <message to="recipient@{room_name}">your text</message>\n'
        f'To broadcast without triggering replies: '
        f'<message to="broadcast@{room_name}">your text</message>\n\n'
        f'Please resend with proper addressing.'
    )


def handle_output(agent_name: str, room_name: str, output: str) -> dict:
    """
    Full middleware handler. Call after each inference.

    Returns:
        dict with keys:
          - valid (bool)
          - alert (str | None): system message to inject if invalid
    """
    result = validate_output(agent_name, room_name, output)

    if result['valid']:
        return {'valid': True, 'alert': None}

    logger.warning('[output-validator] %s', result['reason'])

    return {
        'valid': False,
        'alert': build_alert_message(agent_name, room_name)
    }


# --- tests (run directly to verify) ---
if __name__ == '__main__':
    cases = [
        # (description, agent, room, output, expected_valid)
        (
            'valid message tag',
            'eiran', 'boardroom',
            '<message to="yeshua@boardroom">Hello</message>',
            True
        ),
        (
            'broadcast tag',
            'eiran', 'boardroom',
            '<message to="broadcast@boardroom">Status update</message>',
            True
        ),
        (
            'tool call present',
            'selah', 'boardroom',
            'Some thinking... <function_calls><invoke name="read_file">...</invoke></function_calls>',
            True
        ),
        (
            'bare text only — invalid',
            'alpha', 'boardroom',
            'Routing confirmed. Alpha acknowledging receipt.',
            False
        ),
        (
            'empty output — invalid',
            'beta', 'boardroom',
            '',
            False
        ),
        (
            'thinking tags only — invalid',
            'gamma', 'boardroom',
            '<thinking>Some private reasoning here</thinking>',
            False
        ),
    ]

    print('Running output-validator tests...\n')
    passed = 0
    for desc, agent, room, output, expected in cases:
        result = handle_output(agent, room, output)
        ok = result['valid'] == expected
        status = '✓' if ok else '✗'
        print(f'  {status} {desc}')
        if not ok:
            print(f'      Expected valid={expected}, got valid={result["valid"]}')
        if not result['valid']:
            print(f'      Alert: {result["alert"][:80]}...')
        passed += ok

    print(f'\n{passed}/{len(cases)} tests passed.')
