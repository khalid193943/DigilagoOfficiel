# Raccourcis : make install, make build, make serve, make test
install:
	pip install -r requirements.txt
	python -m playwright install chromium
# Applique toutes les optimisations sur site/ (idempotent)
build:
	python3 tools/build.py
# Régénère les pages avec le générateur d'origine (sources complètes requises), puis optimise
build-pages:
	cd src && python3 build.py && python3 gen_pages.py && python3 finalize.py && python3 extras.py
	python3 tools/build.py
serve:
	python3 -m http.server 4173 --directory site
test:
	pytest tests -q
