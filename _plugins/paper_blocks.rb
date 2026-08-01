# frozen_string_literal: true

require 'cgi'

# Converts the paper editor's fenced scholarly blocks into HTML that Kramdown
# can render during the GitHub Actions build. GitHub Pages is deployed from the
# custom Jekyll workflow, so repository plugins are available.
module Aicra
  module PaperBlocks
    BLOCK_LABELS = {
      'abstract' => 'Abstract',
      'theorem' => 'Theorem',
      'proof' => 'Proof',
      'algorithm' => 'Algorithm'
    }.freeze

    module_function

    def transform(content)
      lines = content.lines
      output = []
      index = 0

      while index < lines.length
        opener = lines[index].match(/^:::(abstract|theorem|proof|algorithm)(?:\s+(.+?))?\s*$/)
        unless opener
          output << lines[index]
          index += 1
          next
        end

        kind = opener[1]
        title = opener[2]&.strip
        body = []
        index += 1
        while index < lines.length && lines[index].strip != ':::'
          body << lines[index]
          index += 1
        end
        index += 1 if index < lines.length

        output << %(<section class="paper-block paper-block--#{kind}" markdown="1">\n)
        output << %(<p class="paper-block__label">#{BLOCK_LABELS.fetch(kind)}</p>\n)
        output << %(<h4 class="paper-block__title">#{CGI.escapeHTML(title)}</h4>\n) if title && !title.empty?
        output << "\n"
        output.concat(body)
        output << "\n</section>\n"
      end

      normalized = output.join
      normalized.gsub!(/\\label\{([^}]+)\}/, '<span id="\\1" class="paper-anchor" aria-hidden="true"></span>')
      normalized.gsub!(/\\ref\{([^}]+)\}/, '<a class="paper-ref" href="#\\1">\\1</a>')
      normalize_tables(normalized)
    end

    def normalize_tables(content)
      lines = content.lines
      output = []
      in_table = false

      lines.each do |line|
        table_line = line.lstrip.start_with?('|')
        output << "\n" if table_line && !in_table && !output.empty? && !output.last.strip.empty?
        output << "\n" if !table_line && in_table && !line.strip.empty?
        output << line
        in_table = table_line
      end

      output.join
    end
  end
end

Jekyll::Hooks.register :documents, :pre_render do |document|
  next unless document.collection.label == 'papers'

  document.content = Aicra::PaperBlocks.transform(document.content)
end
