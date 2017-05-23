var markdownIt = require("markdown-it");
var highlightCode = require("heckle-blog/highlightCode")

let markdown = markdownIt({highlight: highlightCode, langPrefix: 'lang-', html: true});
markdown.use(require('markdown-it-footnote'));
markdown.use(require('markdown-it-anchor'), {
  slugify: function(s) { return s.toLowerCase().replace(/\W/g, '_').replace(/^_+/, '').replace(/_+$/, ''); },
  permalink: true,
  permalinkSymbol: '§'
});
markdown.use(function (md) {
  var beginMarker = '::: toggleable';
  var endMarker = ':::';
  function toggleable(state, silent) {
    if (!state.env.toggleable) {
      if (state.pos + beginMarker.length > state.posMax) return false;
      if (state.src.substr(state.pos, beginMarker.length) !== beginMarker) return false;
      var beginPos = state.src.indexOf('\n', state.pos + beginMarker.length) + 1;
      var m1 = state.src.substr(state.pos + beginMarker.length, beginPos - state.pos - beginMarker.length - 1);
      var token = state.push('toggleable_begin', '', 0);
      token.meta = { text: m1 };
      state.env.toggleable = m1;
    } else {
      if (state.pos + endMarker.length > state.posMax) return false;
      if (state.src.substr(state.pos, endMarker.length) !== endMarker) return false;
      var beginPos = state.pos + endMarker.length
      var token = state.push('toggleable_end', '', 0);
      token.meta = { text: state.env.toggleable };
      state.env.toggleable = false;
    }

    state.pos = beginPos;
    return true;
  }
  md.inline.ruler.after('image', 'toggleable', toggleable);

  md.renderer.rules.toggleable_begin = function(tokens, idx) {
    var text = tokens[idx].meta.text;
    var slug = text.toLowerCase().replace(/\W/g, '_');
    var res = `<span class="toggleable">` +
           `<span class="link-target" id="show_${slug}"></span>` +
           `<span class="content">`;
    return res;
  };
  md.renderer.rules.toggleable_end = function(tokens, idx) {
    var text = tokens[idx].meta.text;
    var slug = text.toLowerCase().replace(/\W/g, '_');
    return `<a class="hide" href="#hide_${slug}">Hide ${text}</a></span>` +
           `<a class="show" href="#show_${slug}">Show ${text}</a>` +
           `</span>`;
  }
});

module.exports = markdown.render.bind(markdown)
