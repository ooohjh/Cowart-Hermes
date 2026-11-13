"""Offline host integration. Run with isolated HERMES_HOME and host Python."""
import json, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0, sys.argv.pop(1))
from tools import image_generation_tool as tool
from tools import image_generation_cowart as lifecycle
from PIL import Image

class FailureTests(unittest.TestCase):
    def test_failure_paths(self):
        for raw in [json.dumps({'success':False,'error':'502'}), json.dumps({'success':True,'image':'missing.png'}), 'invalid-json', RuntimeError('provider raised')]:
            with self.subTest(raw=str(raw)):
                job=dict(id='test-task',sessionId='session',requestHash='hash',dimensions=dict(width=32,height=24))
                events=[]
                def cb(root, job, action, data=None):
                    events.append(action)
                    return dict(status='running' if action=='claim' else 'failed',claimed=True)
                generate=Mock(side_effect=raw) if isinstance(raw,Exception) else Mock(return_value=raw)
                with patch.object(lifecycle,'resolve_task',return_value=(Path('.'),job)),patch.object(lifecycle,'callback',side_effect=cb),patch('socket.socket.connect',side_effect=AssertionError('network forbidden')):
                    result=json.loads(lifecycle.run({}, {}, generate))
                self.assertFalse(result['success']);self.assertEqual(events,['claim','fail'])

    def test_duplicate_does_not_generate(self):
        generate=Mock()
        with patch.object(lifecycle,'resolve_task',return_value=(Path('.'),dict(id='test-task'))),patch.object(lifecycle,'callback',return_value=dict(status='running',claimed=False)):
            self.assertEqual(json.loads(lifecycle.run({}, {},generate))['error_type'],'cowart_duplicate')
        generate.assert_not_called()

    def test_plain_chat_and_missing_id(self):
        self.assertIsNone(lifecycle.resolve_task({},'hello','session'))
        with self.assertRaises(ValueError): lifecycle.resolve_task({},json.dumps(dict(prompt='x',provider_alias='x',model='x',size='x')),'session')

    def test_frozen_session_and_hash(self):
        import hashlib
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);args=dict(prompt='测试',provider_alias='x',model='x',size='32x24')
            job=dict(id='test-task',sessionId='session',mode='text',userInitiated=True,approvalMode='user_confirmed',**args)
            job['requestHash']=hashlib.sha256(json.dumps(args,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            (root/'config.json').write_text(json.dumps(dict(canvasDir=d)))
            (root/'hermes-creation-state.json').write_text(json.dumps(dict(jobs={'test-task':job})))
            (root/'image_generation_capability_binding.local.json').write_text(json.dumps(dict(source=str(root/'model-capabilities.json'))))
            text='COWART_TASK_ID=test-task\n'+json.dumps(args)
            with patch.object(lifecycle,'__file__',str(root/'image_generation_cowart.py')):
                self.assertEqual(lifecycle.resolve_task(args,text,'session')[1]['id'],'test-task')
                with self.assertRaises(ValueError): lifecycle.resolve_task(args,text,'other')
                with self.assertRaises(ValueError): lifecycle.resolve_task({**args,'prompt':'changed'},text,'session')
                job['requestHash']='changed'
                (root/'hermes-creation-state.json').write_text(json.dumps(dict(jobs={'test-task':job})))
                with self.assertRaises(ValueError): lifecycle.resolve_task(args,text,'session')

class LifecycleTests(unittest.TestCase):
    def test_real_handler_provider_mock(self):
        from types import SimpleNamespace
        from tools import image_generation_explicit as gate
        from tools.image_generation_approval import ImageApproval
        with tempfile.TemporaryDirectory() as d:
            image=Path(d)/'actual.png';Image.new('RGB',(32,24)).save(image)
            for dimensions in [(32,24),(64,64)]:
                job=dict(id='test-task',sessionId='session',requestHash='hash',dimensions=dict(zip(('width','height'),dimensions)))
                events=[]
                def cb(root,job,action,data=None):
                    events.append(action)
                    return dict(status={'claim':'running','complete':'completed','fail':'failed'}[action],claimed=True)
                provider=SimpleNamespace(generate=Mock(return_value=dict(success=True,image=str(image))))
                with patch.object(lifecycle,'resolve_task',return_value=(Path(d),job)),patch.object(lifecycle,'callback',side_effect=cb),patch.object(gate,'validate_route'),patch('tools.image_generation_approval.approval_for',return_value=ImageApproval('cowart_user_submit','session','turn','fixture','test-task')),patch.object(tool,'_get_plugin_provider',return_value=provider),patch('socket.socket.connect',side_effect=AssertionError('network forbidden')):
                    result=json.loads(tool._handle_image_generate(dict(prompt='fixture',provider_alias='fixture',model='fixture',size='32x24'),session_id='session',turn_id='turn'))
                self.assertEqual(provider.generate.call_count,1)
                self.assertEqual(events,['claim','complete' if dimensions==(32,24) else 'fail'])
                self.assertEqual(result['success'],dimensions==(32,24))

    def test_success_measures_and_callbacks(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'result.png'
            Image.new('RGB', (32, 24)).save(image)
            job = dict(id='test-task-1234', sessionId='session', requestHash='hash', dimensions=dict(width=32,height=24))
            events=[]
            def callback(root, job, action, data=None):
                events.append((action,data))
                return {**job, 'claimed': True, 'status': 'running' if action=='claim' else 'completed'}
            with patch.object(lifecycle, 'resolve_task', return_value=(Path(directory),job)), patch.object(lifecycle,'callback',side_effect=callback), patch.object(tool,'_handle_image_generate_inner',return_value=json.dumps(dict(success=True,image=str(image)))):
                result=json.loads(tool._handle_image_generate({},user_task='COWART_TASK_ID=test-task-1234\n{}',session_id='session',turn_id='turn'))
            self.assertTrue(result['success'])
            self.assertEqual([x[0] for x in events], ['claim','complete'])
            self.assertEqual(events[-1][1]['width'],32)
            self.assertEqual(result['cowart_task_id'],job['id'])

if __name__=='__main__': unittest.main()


