.PHONY: install
install:
	npm install -g respec


.PHONY: spec
spec:
	respec --verbose --localhost --src spec/index.html --out web/index.html


.PHONY: serve
.ONESHELL: serve
serve:
	python -m http.server --directory web 1234
