CREATE SCHEMA IF NOT EXISTS new_stresstest;


CREATE OR replace TABLE new_stresstest.test_changelog_table AS
                        WITH a          AS
                        (
                               SELECT date_from_unix_date(cast(rand() * 10000 AS int64))                         AS timestamp,
                                      generate_uuid()                                                            AS event_id,
                                      'projects/myproject/databases/(default)/documents/mycollection/mydocument' AS document_name,
                                      'UPDATE'                                                                   AS operation,
                                      string_agg(concat(word, word), '')                                         AS data,
                                      'mydocument'                                                               AS document_id
                               FROM   `publicdata.samples.shakespeare`
                        )SELECT a.*
                 FROM   a,
                        `publicdata.samples.shakespeare` limit 20000;