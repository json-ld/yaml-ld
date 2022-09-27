#!/usr/bin/env node

import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

// Extract a map of manfests to map of test identifiers to the element ids referencing them.
async function extractIssueMap(source, callback) {
  const spec = path.join(__dirname, source);
  // Read in spec
  readFile(spec)
    .then((data) => new JSDOM(data))
    .then((dom) => {
      var issueMap = {};
      const elements = dom.window.document.querySelectorAll('*[data-tests]');
      for(const e of elements) {
        // Map each test to the element ids referencing it.
        const tests = e.dataset['tests'].split(',').map(e => e.trim());
        for(const tid of tests) {
          const [man, tt] = tid.split('#')
          issueMap[man] ||= {};
          issueMap[man][tt] ||= [];
          issueMap[man][tt].push(e.id);
        }
      }
      callback(issueMap);
    });
}

// Add specification references to the manifest test entries.
// Also adds empty test entries when a test is referenced, but not defined.
function annotateManifest(jsonld, manifest, issueMap) {
  // Start with manifest without test sequences
  var annotatedManifest = Object.assign({}, manifest, {sequence: []});
  var testReferences = [];

  for(const entry of manifest.sequence) {
    switch(typeof entry) {
    case 'string':
      annotatedManifest.sequence.push(entry);
      break;
    case 'object':
      const tid = entry['@id'].substring(1)
      if(tid in issueMap) {
        const newEntry = Object.assign({}, entry, {specRefs: issueMap[tid]});
        annotatedManifest.sequence.push(newEntry);
        testReferences.push(tid);
      } else {
        console.log(`Test "${tid}" defined in ${jsonld} but not referenced in spec.`);
      }
      break;
    }
  }

  // map entries not in testReferences are noted.
  for (const tid in issueMap) {
    if (!testReferences.includes(tid)) {
      console.log(`Test "${tid}" referenced from spec but not defined in ${jsonld}.`)
    }
  }

  return annotatedManifest;
}

async function generateHtml(jsonld, manifest, hpath) {
  const html = `
<!doctype html>
<!-- This template is used for generating the HTML representation of the test suite manifests. -->
<html>
  <head>
    <title>${manifest.name}</title>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    <link rel="alternate" href="${manifest.id}" />
    <link rel="styesheet" href="https://www.w3.org/StyleSheets/TR/base" />
    <style>
      dl.entry dt { font-weight: bold}
    </style
  </head>
  <body>
    <p>
      <a href="http://www.w3.org/">
        <img src="http://www.w3.org/Icons/w3c_home" alt="W3C" height="48" width="72" />
      </a>
    </p>
    <section>
      <h1>${manifest.name}</h1>

      ${marked.parse(manifest.description)}

      <p>
        This is an HTML version of a test manifest. The JSON-LD version of this manifest may be found at
        <a href="${jsonld}.jsonld">${jsonld}.jsonld</a>.
        The manifest vocabulary is described in the
        <a href="https://w3c.github.io/json-ld-api/tests/vocab.html">JSON-LD Test Vocabulary</a> (
        <a href="https://w3c.github.io/json-ld-api/tests/vocab.jsonld">JSON-LD</a>,
        <a href="https://w3c.github.io/json-ld-api/tests/vocab.ttl">Turtle</a>
        )
        and is based on the
        <a href="http://www.w3.org/TR/2014/NOTE-rdf11-testcases-20140225/">RDF Test Vocabulary</a>.
      </p>

      <p>
        The YAML-LD Test Suite is a set of tests that can
        be used to verify YAML-LD Processor conformance to the set of specifications
        that constitute YAML-LD. The goal of the suite is to provide an easy and
        comprehensive YAML-LD testing solution for developers creating YAML-LD Processors.
      </p>

      <section>
        <h2>General instructions for running the YAML-LD Test suite</h2>
        <p>Described in the <a href="README.md">README</a>.</p>
      </section>

      <section>
        <h2>Contributing Tests</h2>
        <p>If you would like to contribute a new test
          or a fix to an existing test,
          please follow these steps:
        </p>

        <ol>
          <li>Notify the JSON-LD mailing list,
            <a href="mailto:public-json-ld-wg@w3.org">
              public-json-ld-wg@w3.org
            </a>,
            that you will be creating a new test or fix and the purpose of the
            change.
          </li>
          <li>Clone the git repository:
            <a href="git://github.com/w3c/json-ld-api.git">
              git://github.com/w3c/json-ld-api.git
            </a>.
          </li>
          <li>
            In a separate branch, make your changes and submit them via a GitHub Pull Request.
          </li>
        </ol>
      </section>

      <section>
        <h2>Distribution</h2>
        <p>Distributed under the
          <a href="http://www.w3.org/Consortium/Legal/2008/04-testsuite-license">
            W3C Test Suite License
          </a>.
          To contribute to a W3C Test Suite, see the 
          <a href="http://www.w3.org/2004/10/27-testcases">
            policies and contribution forms
          </a>.
        </p>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <p>
          UNDER THE EXCLUSIVE LICENSE, THIS DOCUMENT AND ALL DOCUMENTS, TESTS
          AND SOFTWARE THAT LINK THIS STATEMENT ARE PROVIDED "AS IS," AND
          COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
          IMPLIED, INCLUDING, BUT NOT LIMITED TO, WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT,
          OR TITLE; THAT THE CONTENTS OF THE DOCUMENT ARE SUITABLE FOR ANY
          PURPOSE; NOR THAT THE IMPLEMENTATION OF SUCH CONTENTS WILL NOT
          INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER
          RIGHTS.
        </p>

        <p>
          COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT,
          SPECIAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE
          DOCUMENT OR THE PERFORMANCE OR IMPLEMENTATION OF THE CONTENTS THEREOF.
        </p>
      </section>
    </section>

    <section>
      <h1>Test Definitions</h1>
      ${manifest.baseIri ? `<dl class="entry"><dt>baseIri</dt><dd>${manifest.baseIri}</dd></dl>` : ""}
      ${typeof manifest.sequence[0] === 'string' ? '<ul class="entry">' : '<dl class="entry">'}
      ${manifest.sequence.map((entry) => {
        switch(typeof entry) {
          case 'string':
             // Referece the HTML manifest, not the JSON-LD
            const f = entry.replace('jsonld', 'html');

            return `<li><a href="${f}">${f}</a></li>`;
          case 'object':
            // Generate the test entry
            return `
              <dt id="${entry['@id'].substring(1)}">
                Test ${entry['@id'].substring(1)} ${entry.name}
              </dt>
              <dd>
                <dl class="entry">
                  <dt>ID</dt><dd>${entry['@id']}</dd></dt>
                  <dt>Type</dt><dd>${entry['@type']}</dd>
                  <dt>Name</dt><dd>${entry.name}</dd></dt>
                  <dt>Purpose</dt><dd>${marked.parseInline(entry.purpose)}</dd></dt>
                  <dt>Input</dt><dd><a href="${entry.input}">${entry.input}</a></dd></dt>
                  <dt>References</dt><dd>${
                    entry.specRefs.map((r, ndx) => `(<a href="../spec/index.html#${r}">${ndx + 1}</a>)`).join(' ')
                  }</dd></dt>
                  ${entry.context ? `<dt>Context</dt><dd><a href="${entry.context}">${entry.context}</a></dd>` : ''}
                  ${entry.frame ? `<dt>Frame</dt><dd><a href="${entry.frame}">${entry.frame}</a></dd>` : ''}
                  ${entry.expect ? `<dt>Expect</dt><dd><a href="${entry.expect}">${entry.expect}</a></dd>` : ''}
                  ${entry.expectErrorCode ? `<dt>Expect Error Code</dt><dd>${entry.expectErrorCode}</dd>` : ''}
                  ${entry.option ?
                    `<dt>Options</dt>
                    <dd><dl class="options">
                    ${Object.keys(entry.option).map(k => `<dt>${k}</dt><dd>${entry.option[k]}</dd>`).join("\n")}
                    </dl></dd>` : ''}
                </dl>
              </dd>`;
        }
      }).join("\n")}
      ${typeof manifest.sequence[0] === 'string' ? '</ul>' : '</dl>'}
    </section>
  </body>
</html>
`;
  // Write out the HTML version of the manifest
  fs.writeFile(hpath, html, (err) => {
    if (err) {console.log(err)};
  });
}

async function main(jsonld, html, issueMap) {
  const mpath = path.join(__dirname, jsonld);
  const hpath = path.join(__dirname, html);

  // Read in JSON-LD manifest
  readFile(mpath)
    .then((data) => JSON.parse(data))
    .then((manifest) => {
      // Annotate the manifest with spec references.
      const annotatedManifest = annotateManifest(jsonld, manifest, issueMap[html] || {});

      // Generate the HTML version using the annotated manifest.
      generateHtml(jsonld, annotatedManifest, hpath);
 
      // Recursively transform referenced manifests
      for(var entry of manifest.sequence) {
        if(typeof entry === 'string') {
          // Recursively generate referenced test manifest
          main(entry, entry.replace('jsonld', 'html'), issueMap);
        }
      }

    });
}

// Create a map of tests to references by manifest.
extractIssueMap("../spec/index.html", (issueMap) => {
// Convert manifest, which will recursively convert referenced manifests.
  main("manifest.jsonld", "manifest.html", issueMap)
});
