UPDATE "Deck"
SET "markdown" = replace("markdown", '/api/images/', '/api/media/')
WHERE "markdown" LIKE '%/api/images/%';

UPDATE "SlideLibraryItem"
SET "markdown" = replace("markdown", '/api/images/', '/api/media/')
WHERE "markdown" LIKE '%/api/images/%';
