(function () {
  'use strict';

  var pendingCardSelectors = [
    '.member-post-card--pending[data-id]',
    '.pb-card[data-id]:has(.pb-status--pending)'
  ];
  var pendingEditSelector = [
    '.member-post-card--pending .bb-edit[data-id]',
    '.pb-card:has(.pb-status--pending) .pb-edit[data-id]'
  ].join(',');
  var activePendingId = '';

  function setText(element, value) {
    if (element && element.textContent.trim() !== value) {
      element.textContent = value;
    }
  }

  function pendingCards(root) {
    var cards = [];

    pendingCardSelectors.forEach(function (selector) {
      try {
        cards = cards.concat(Array.prototype.slice.call(root.querySelectorAll(selector)));
      } catch (error) {
        // Older browsers without :has() still support the primary blog cards.
      }
    });

    return cards;
  }

  function pendingIds(root) {
    return pendingCards(root).map(function (card) {
      return String(card.dataset.id || '');
    }).filter(Boolean);
  }

  function cardTitle(button) {
    var card = button.closest('article');
    var heading = card && card.querySelector('h3');
    return heading ? heading.textContent.trim() : '승인 대기 글';
  }

  function enhancePendingCards(root) {
    var buttons;

    try {
      buttons = root.querySelectorAll(pendingEditSelector);
    } catch (error) {
      buttons = root.querySelectorAll('.member-post-card--pending .bb-edit[data-id]');
    }

    Array.prototype.forEach.call(buttons, function (button) {
      if (button.dataset.pendingEditEnhanced === 'true') return;

      var title = cardTitle(button);
      button.dataset.pendingEditEnhanced = 'true';
      button.setAttribute('aria-label', title + ' 수정');
      button.setAttribute('title', '승인 대기 중에도 수정할 수 있습니다');
      button.addEventListener('click', function () {
        activePendingId = String(button.dataset.id || '');
        window.setTimeout(function () {
          enhanceComposeForm(document);
        }, 0);
      });
    });

    var policy = root.getElementById && root.getElementById('pending-edit-policy');
    if (policy) {
      setText(
        policy,
        '승인 대기 중인 글도 수정할 수 있습니다. 저장하면 새 글을 만들지 않고 기존 글을 갱신하며, 승인 대기 상태는 그대로 유지됩니다.'
      );
      policy.hidden = pendingIds(root).length === 0;
    }
  }

  function rememberText(element, key) {
    if (element && !element.dataset[key]) {
      element.dataset[key] = element.textContent.trim();
    }
  }

  function restoreComposeForm(form) {
    var container = form.closest('.blog-compose-inner');
    if (!container) return;

    activePendingId = '';

    var heading = container.querySelector('.blog-compose-title');
    var hint = container.querySelector('.blog-compose-hint');
    var submit = form.querySelector('#blog-compose-submit');
    var notice = form.querySelector('.pending-edit-notice');

    if (form.classList.contains('blog-compose-form--pending-edit')) {
      form.classList.remove('blog-compose-form--pending-edit');
    }
    if (heading && heading.dataset.pendingOriginalText) setText(heading, heading.dataset.pendingOriginalText);
    if (hint && hint.dataset.pendingOriginalText) setText(hint, hint.dataset.pendingOriginalText);
    if (submit && submit.dataset.pendingOriginalText) setText(submit, submit.dataset.pendingOriginalText);
    if (submit) submit.removeAttribute('aria-describedby');
    if (notice) notice.remove();
  }

  function enhanceComposeForm(root) {
    var form = root.querySelector('#blog-compose-form');
    if (!form) return;

    var editId = String(form.dataset.editId || '');
    var isPending = Boolean(editId) && (
      pendingIds(root).indexOf(editId) !== -1 || activePendingId === editId
    );

    if (!isPending) {
      restoreComposeForm(form);
      return;
    }

    var container = form.closest('.blog-compose-inner');
    if (!container) return;

    var heading = container.querySelector('.blog-compose-title');
    var hint = container.querySelector('.blog-compose-hint');
    var submit = form.querySelector('#blog-compose-submit');
    var notice = form.querySelector('.pending-edit-notice');

    rememberText(heading, 'pendingOriginalText');
    rememberText(hint, 'pendingOriginalText');
    rememberText(submit, 'pendingOriginalText');

    if (!form.classList.contains('blog-compose-form--pending-edit')) {
      form.classList.add('blog-compose-form--pending-edit');
    }
    setText(heading, '승인 대기 글 수정');
    if (hint) {
      setText(hint, '기존 글을 수정합니다. 저장해도 새 글이 생성되지 않으며 승인 대기 상태가 유지됩니다.');
    }

    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'pending-edit-notice';
      notice.className = 'pending-edit-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = '승인 전까지 여러 번 수정할 수 있습니다. 관리자는 가장 최근에 저장한 내용을 검토합니다.';
      form.insertBefore(notice, form.firstElementChild);
    }

    if (submit) {
      setText(submit, '수정 내용 저장');
      submit.setAttribute('aria-describedby', 'pending-edit-notice');
    }
  }

  function enhance(root) {
    enhancePendingCards(root);
    enhanceComposeForm(root);
  }

  function start() {
    enhance(document);

    var observer = new MutationObserver(function () {
      enhance(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-edit-id']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
