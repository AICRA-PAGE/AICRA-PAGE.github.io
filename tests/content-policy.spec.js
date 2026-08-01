const assert = require('node:assert/strict');
const test = require('node:test');

const { containsForbiddenSection } = require('../scripts/validate-frontmatter');

test('should reject AICRA public research proposal section headings', () => {
  assert.equal(containsForbiddenSection('## AICRA 공개 연구 제안\n\n본문'), true);
  assert.equal(containsForbiddenSection('### 공개 연구 제안: 후속 과제\n\n본문'), true);
});

test('should allow ordinary research project descriptions', () => {
  assert.equal(
    containsForbiddenSection('이 프로젝트는 재현 가능한 공개 연구 제안입니다.'),
    false,
  );
});
