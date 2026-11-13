"""Offline host compatibility check. Never import provider/credentials or patch core."""
import ast
import importlib.util
import json
import pathlib
import sys


def check(source):
    source = pathlib.Path(source)
    sys.path.insert(0, str(source))
    file = source / 'tools/image_generation_explicit.py'
    spec = importlib.util.spec_from_file_location('cowart_host_gate', file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.CAPABILITY_SCHEMA == 6, 'schema 6 required'
    from tools.image_generation_approval import ImageApproval, POLICY_VERSION
    assert POLICY_VERSION == 1, 'source-aware approval policy required'
    assert module.operation_for(reference_paths=['not-read.png']) == 'images.edit'
    assert module.operation_for() == 'images.generate'
    module.load_registry = lambda: {'models': [{'alias': 'offline', 'model': 'offline', 'operations': {
        'images.generate': {'status': 'verified', 'evidence': ['offline fixture'], 'sizes': [{'width': 1360, 'height': 2048}]},
        'images.edit': {'status': 'unknown', 'sizes': []}}}]}
    assert module.validate_route('offline', 'offline', '1360x2048', 'images.generate')
    try:
        module.validate_route('offline', 'offline', '1360x2048', 'images.edit')
    except ValueError:
        pass
    else:
        raise AssertionError('edit must not inherit generate evidence')
    assert module.validate_route('offline', 'offline', '1360x2048', 'images.edit', approval=ImageApproval('cowart_user_submit', 'offline-session', 'offline-turn'))
    for name in ['tools/image_generation_tool.py', 'plugins/image_gen/openai/__init__.py']:
        tree = ast.parse((source / name).read_text(encoding='utf-8'))
        calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)]
        assert any(n.func.id == 'operation_for' for n in calls), name + ': operation derivation missing'
        assert any(n.func.id == 'validate_route' and len(n.args) == 4 and isinstance(n.args[3], ast.Name) and n.args[3].id == 'operation' for n in calls), name + ': operation-aware validation missing'
    for name, required in {
        'agent/turn_context.py': '_image_user_task',
        'agent/tool_executor.py': '_image_user_task',
        'agent/agent_runtime_helpers.py': '_image_user_task',
        'model_tools.py': '"turn_id": ids.turn_id',
        'tools/image_generation_tool.py': '_image_approval=approval',
        'plugins/image_gen/openai/__init__.py': 'approval=kwargs.get("_image_approval")',
    }.items():
        assert required in (source / name).read_text(encoding='utf-8'), name + ': source context wiring missing'
    # Exercise the actual handler with the source policy, not just a synthetic approval.
    from types import SimpleNamespace
    from unittest.mock import Mock, patch
    from tools.image_generation_cowart import LIFECYCLE_VERSION
    assert LIFECYCLE_VERSION == 1, 'Cowart task lifecycle v1 required'
    import subprocess
    subprocess.run([sys.executable, str(pathlib.Path(__file__).parent/'tests/task-lifecycle-test.py'), str(source)], check=True)
    from tools import image_generation_tool as handler
    from tools import image_generation_explicit as gate
    args = dict(prompt='offline', provider_alias='offline', model='offline', size='1360x2048', image_url='data:image/png;base64,AA==')
    provider = SimpleNamespace(generate=Mock(return_value={'success': False, 'error': 'offline provider mock', 'error_type': 'api_error'}))
    with patch('socket.socket.connect', side_effect=AssertionError('network forbidden')), patch.object(gate, 'load_registry', module.load_registry), patch.object(handler, '_get_plugin_provider', return_value=provider), patch.object(handler, '_confine_source_images', side_effect=lambda a,b,*rest: (a,b,None)), patch('agent.delegation_context.is_delegated_child_context', return_value=False), patch('gateway.session_context.get_session_env', return_value=''):
        direct = json.loads(handler._handle_image_generate(args, user_task='Edit this image', session_id='offline', turn_id='turn'))
        assert direct.get('error_type') == 'api_error', direct
        assert provider.generate.call_count == 1
        assert provider.generate.call_args.kwargs['_image_approval'].source == 'user_direct'
        blocked = json.loads(handler._handle_image_generate({**args, 'userInitiated': True, 'approvalMode': 'user_confirmed'}, user_task='Build a website', session_id='offline', turn_id='turn'))
        assert blocked.get('error_type') == 'approval_required', blocked
        assert provider.generate.call_count == 1
    assert 'host-confirmed user request' in handler.IMAGE_GENERATE_SCHEMA['parameters']['properties']['size']['description'], 'stale image schema'
    return {'ok': True, 'schema': 6, 'paidRequests': 0, 'directUnknownEdit': 'provider_mock', 'autonomousUnknownEdit': 'approval_required', 'module': handler.__file__, 'scope': 'fresh process only; fully restart gateway externally and check live schema before use'}


if __name__ == '__main__':
    try:
        print(json.dumps(check(sys.argv[1])))
    except Exception as exc:
        print('Incompatible Hermes core: operation-aware schema 6 validator/handler/provider required; this adapter does not install core patches. ' + str(exc), file=sys.stderr)
        sys.exit(1)
