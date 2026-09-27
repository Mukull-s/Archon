import assert from 'node:assert/strict';
import { parseSourceFile, getCodeSymbols, resolveDependencies } from '../src/services/ast.service';

async function runPythonASTTests() {
  console.log('======================================================');
  console.log('RUNNING ARCHON PYTHON AST PARSING TESTS (P1-9)');
  console.log('======================================================\n');

  // Test 1: Multi-line parenthesized imports and multi-import statements
  console.log('-> Running Test 1: Multi-line and parenthesized imports');
  const pythonCode1 = `
import sys, os, json as json_lib, math
from services.auth import (
    login_user,
    verify_token,
    Role
)
from .models import User, Profile
from ..core.config import settings
from . import helpers
`;

  const meta1 = parseSourceFile('app/api/auth.py', pythonCode1);
  assert.ok(meta1.imports.includes('sys'), 'Must include sys');
  assert.ok(meta1.imports.includes('os'), 'Must include os');
  assert.ok(meta1.imports.includes('json'), 'Must include json (without alias)');
  assert.ok(meta1.imports.includes('math'), 'Must include math');
  assert.ok(meta1.imports.includes('services.auth'), 'Must parse parenthesized module services.auth');
  assert.ok(meta1.imports.includes('.models'), 'Must parse relative import .models');
  assert.ok(meta1.imports.includes('..core.config'), 'Must parse relative parent import ..core.config');
  assert.ok(meta1.imports.includes('.helpers'), 'Must parse relative dot-import .helpers');
  console.log('   [PASS] Test 1: Multi-line parenthesized and comma-separated imports correctly parsed.\n');

  // Test 2: Conditional imports and docstring exclusion
  console.log('-> Running Test 2: Conditional imports and docstrings');
  const pythonCode2 = `
"""
from fake_module import do_not_parse_me
import fake_dependency
"""

try:
    import ujson as json
except ImportError:
    import json

if False:
    from typing_extensions import Protocol
`;

  const meta2 = parseSourceFile('app/utils/serializer.py', pythonCode2);
  assert.ok(!meta2.imports.includes('fake_module'), 'Must NOT extract imports inside docstrings');
  assert.ok(!meta2.imports.includes('fake_dependency'), 'Must NOT extract imports inside docstrings');
  assert.ok(meta2.imports.includes('ujson'), 'Must extract try-block import ujson');
  assert.ok(meta2.imports.includes('json'), 'Must extract except-block import json');
  assert.ok(meta2.imports.includes('typing_extensions'), 'Must extract conditional block import typing_extensions');
  console.log('   [PASS] Test 2: Docstrings ignored and conditional/indented imports parsed.\n');

  // Test 3: Decorated functions, classes, methods, and export conventions
  console.log('-> Running Test 3: Decorated functions, class methods, and export semantics');
  const pythonCode3 = `
@app.route('/users')
@require_auth(roles=['admin'])
def get_users():
    return []

def _private_utility():
    pass

class AccountService:
    def __init__(self, db_client):
        self.db = db_client

    @property
    def is_connected(self):
        return True

    def calculate_balance(self, user_id):
        return 100.0
`;

  const meta3 = parseSourceFile('app/services/account.py', pythonCode3);
  assert.ok(meta3.classes.includes('AccountService'), 'Must include AccountService in classes');
  assert.ok(meta3.functions.includes('get_users'), 'Must include get_users function');
  assert.ok(meta3.functions.includes('_private_utility'), 'Must include _private_utility function');
  assert.ok(meta3.functions.includes('AccountService.__init__'), 'Must include AccountService.__init__ method');
  assert.ok(meta3.functions.includes('AccountService.is_connected'), 'Must include AccountService.is_connected method');
  assert.ok(meta3.functions.includes('AccountService.calculate_balance'), 'Must include AccountService.calculate_balance method');

  // Exports check: public functions/classes are exported, private _private_utility is NOT exported
  assert.ok(meta3.exports.includes('get_users'), 'Public function get_users must be exported');
  assert.ok(meta3.exports.includes('AccountService'), 'Public class AccountService must be exported');
  assert.ok(!meta3.exports.includes('_private_utility'), 'Private function _private_utility must NOT be exported');
  console.log('   [PASS] Test 3: Decorators, class methods, and PEP 8 export filtering working.\n');

  // Test 4: Explicit __all__ export definition
  console.log('-> Running Test 4: Explicit __all__ exports');
  const pythonCode4 = `
__all__ = ['ClientFactory', 'connect']

def connect():
    pass

def other_func():
    pass

class ClientFactory:
    pass
`;

  const meta4 = parseSourceFile('app/client.py', pythonCode4);
  assert.deepEqual(meta4.exports.sort(), ['ClientFactory', 'connect'].sort(), '__all__ must authoritatively define exports');
  console.log('   [PASS] Test 4: Explicit __all__ overrides default export discovery.\n');

  // Test 5: getCodeSymbols produces accurate line ranges for Python
  console.log('-> Running Test 5: getCodeSymbols line ranges with decorators and indentation');
  const pythonCode5 = [
    "@app.route('/status')",  // line 1
    "@metric_tracker",        // line 2
    "def status():",           // line 3
    "    res = check()",       // line 4
    "    return res",          // line 5
    "",                        // line 6
    "class Worker:",           // line 7
    "    def run(self):",      // line 8
    "        do_work()"        // line 9
  ].join('\n');

  const symbols = getCodeSymbols('app/worker.py', pythonCode5);
  assert.ok(symbols.length >= 2, `Expected at least 2 symbols, got ${symbols.length}`);

  const statusSymbol = symbols.find(s => s.name === 'status');
  assert.ok(statusSymbol, 'status function symbol must exist');
  assert.equal(statusSymbol.startLine, 1, 'startLine must include decorator (line 1)');
  assert.equal(statusSymbol.endLine, 5, 'endLine must capture function body through line 5');

  const classSymbol = symbols.find(s => s.name === 'Worker');
  assert.ok(classSymbol, 'Worker class symbol must exist');
  assert.equal(classSymbol.startLine, 7, 'Worker class starts on line 7');
  assert.equal(classSymbol.endLine, 9, 'Worker class ends on line 9');
  console.log('   [PASS] Test 5: getCodeSymbols accurately captures line ranges and decorators.\n');

  // Test 6: resolveDependencies for Python relative and package imports
  console.log('-> Running Test 6: Python dependency resolution');
  const workspaceFiles = [
    'app/api/endpoints.py',
    'app/models/user.py',
    'app/services/auth.py',
    'app/utils/helpers.py'
  ];

  const astMap = {
    'app/api/endpoints.py': {
      imports: ['..models.user', '..services.auth'],
      exports: [],
      functions: [],
      classes: []
    },
    'app/services/auth.py': {
      imports: ['..models.user', '.helpers'], // .helpers in same app/services dir wouldn't match, but ..utils.helpers would
      exports: [],
      functions: [],
      classes: []
    }
  };

  const graph = resolveDependencies(workspaceFiles, astMap);
  const endpointDeps = graph['app/api/endpoints.py'] || [];
  assert.ok(endpointDeps.includes('app/models/user.py'), 'Must resolve ..models.user to app/models/user.py');
  assert.ok(endpointDeps.includes('app/services/auth.py'), 'Must resolve ..services.auth to app/services/auth.py');
  console.log('   [PASS] Test 6: Python relative imports resolved accurately in dependency graph.\n');

  console.log('======================================================');
  console.log('ALL 6 PYTHON AST PARSING TESTS (P1-9) PASSED CLEANLY!');
  console.log('======================================================');
}

runPythonASTTests().catch((err) => {
  console.error('[FAIL] Python AST test failed:', err);
  process.exit(1);
});
