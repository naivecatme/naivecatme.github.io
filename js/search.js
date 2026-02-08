// A local search script with the help of
// [hexo-generator-search](https://github.com/PaicHyperionDev/hexo-generator-search)
// Copyright (C) 2015
// Joseph Pan <http://github.com/wzpan>
// Shuhao Mao <http://github.com/maoshuhao>
// This library is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation; either version 2.1 of the
// License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
// 02110-1301 USA
//
// Modified by:
// Pieter Robberechts <http://github.com/probberechts>

/*exported searchFunc*/
var searchFunc = function(path, searchId, contentId) {
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function createHighlightRegex(keywords) {
    var escapedKeywords = keywords.map(function(keyword) {
      return escapeRegExp(keyword);
    }).filter(function(keyword) {
      return keyword.length > 0;
    });

    if (!escapedKeywords.length) {
      return null;
    }

    try {
      return new RegExp("(" + escapedKeywords.join("|") + ")", "gi");
    } catch (e) {
      return null;
    }
  }

  function buildHighlightedFragment(text, regex) {
    var fragment = document.createDocumentFragment();
    if (!regex) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    regex.lastIndex = 0;
    var lastIndex = 0;
    var match = null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      var em = document.createElement("em");
      em.className = "search-keyword";
      em.textContent = match[0];
      fragment.appendChild(em);
      lastIndex = match.index + match[0].length;

      // Prevent zero-length matches from causing an infinite loop.
      if (match.index === regex.lastIndex) {
        regex.lastIndex += 1;
      }
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    return fragment;
  }

  function sanitizeUrl(url) {
    if (!url) {
      return "#";
    }

    var normalized = String(url).trim();
    if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(normalized)) {
      return normalized;
    }

    return "#";
  }

  function stripHtml(html) {
    html = html.replace(/<style([\s\S]*?)<\/style>/gi, "");
    html = html.replace(/<script([\s\S]*?)<\/script>/gi, "");
    html = html.replace(/<figure([\s\S]*?)<\/figure>/gi, "");
    html = html.replace(/<\/div>/ig, "\n");
    html = html.replace(/<\/li>/ig, "\n");
    html = html.replace(/<li>/ig, "  *  ");
    html = html.replace(/<\/ul>/ig, "\n");
    html = html.replace(/<\/p>/ig, "\n");
    html = html.replace(/<br\s*[\/]?>/gi, "\n");
    html = html.replace(/<[^>]+>/ig, "");
    return html;
  }

  function getAllCombinations(keywords) {
    var i, j, result = [];

    for (i = 0; i < keywords.length; i++) {
        for (j = i + 1; j < keywords.length + 1; j++) {
            result.push(keywords.slice(i, j).join(" "));
        }
    }
    return result;
  }

  $.ajax({
    url: path,
    dataType: "xml",
    success: function(xmlResponse) {
      // get the contents from search data
      var datas = $("entry", xmlResponse).map(function() {
        return {
          title: $("title", this).text(),
          content: $("content", this).text(),
          url: $("link", this).attr("href")
        };
      }).get();

      var $input = document.getElementById(searchId);
      if (!$input) { return; }
      var $resultContent = document.getElementById(contentId);

      $input.addEventListener("input", function(){
        var resultList = [];
        var keywords = getAllCombinations(this.value.trim().toLowerCase().split(" "))
          .sort(function(a,b) { return b.split(" ").length - a.split(" ").length; });
        var highlightRegex = createHighlightRegex(keywords);
        $resultContent.innerHTML = "";
        if (this.value.trim().length <= 0) {
          return;
        }
        // perform local searching
        datas.forEach(function(data) {
          var matches = 0;
          if (!data.title || data.title.trim() === "") {
            data.title = "Untitled";
          }
          var dataTitle = data.title.trim().toLowerCase();
          var dataTitleLowerCase = dataTitle.toLowerCase();
          var dataContent = stripHtml(data.content.trim());
          var dataContentLowerCase = dataContent.toLowerCase();
          var dataUrl = data.url;
          var indexTitle = -1;
          var indexContent = -1;
          var firstOccur = -1;
          // only match artiles with not empty contents
          if (dataContent !== "") {
            keywords.forEach(function(keyword) {
              indexTitle = dataTitleLowerCase.indexOf(keyword);
              indexContent = dataContentLowerCase.indexOf(keyword);

              if( indexTitle >= 0 || indexContent >= 0 ){
                matches += 1;
                if (indexContent < 0) {
                  indexContent = 0;
                }
                if (firstOccur < 0) {
                  firstOccur = indexContent;
                }
              }
            });
          }
          // show search results
          if (matches > 0) {
            var searchResult = {};
            searchResult.rank = matches;
            searchResult.title = dataTitle;
            searchResult.url = sanitizeUrl(dataUrl);
            if (firstOccur >= 0) {
              // cut out 100 characters
              var start = firstOccur - 20;
              var end = firstOccur + 80;

              if(start < 0){
                start = 0;
              }

              if(start == 0){
                end = 100;
              }

              if(end > dataContent.length){
                end = dataContent.length;
              }

              var matchContent = dataContent.substring(start, end);
              searchResult.matchContent = matchContent;
            }
            resultList.push(searchResult);
          }
        });
        if (resultList.length) {
          resultList.sort(function(a, b) {
              return b.rank - a.rank;
          });
          var result = document.createElement("ul");
          result.className = "search-result-list";

          for (var i = 0; i < resultList.length; i++) {
            var item = resultList[i];
            var li = document.createElement("li");
            var link = document.createElement("a");

            link.className = "search-result-title";
            link.setAttribute("href", item.url);
            link.textContent = item.title;
            li.appendChild(link);

            if (item.matchContent) {
              var paragraph = document.createElement("p");
              paragraph.className = "search-result";
              paragraph.appendChild(buildHighlightedFragment(item.matchContent, highlightRegex));
              paragraph.appendChild(document.createTextNode("..."));
              li.appendChild(paragraph);
            }

            result.appendChild(li);
          }
          $resultContent.appendChild(result);
        }
      });
    }
  });
};
