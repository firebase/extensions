CREATE SCHEMA IF NOT EXISTS new_stresstest;

CREATE OR replace TABLE new_stresstest.duplicate_timestamp_table AS
                        WITH a          AS
                        (
                               SELECT timestamp("1970-01-01 00:00:00+00")                         AS timestamp,
                                      generate_uuid()                                                            AS event_id,
                                      'projects/myproject/databases/(default)/documents/mycollection/mydocument' AS document_name,
                                      'UPDATE'                                                                   AS operation,
                                      string_agg(concat(word, word), '')                                         AS data,
                                      'mydocument'                                                               AS document_id
                               FROM   `publicdata.samples.shakespeare`
                        ) SELECT a.*
                 FROM   a,
                        `publicdata.samples.shakespeare` limit 10;

CREATE OR replace TABLE new_stresstest.some_null AS
                        WITH a          AS
                        (
                               SELECT
                                      case when rand() < 0.5 then null else timestamp("1970-01-01 00:00:00+00") end AS timestamp,
                                      generate_uuid()                                                            AS event_id,
                                      'projects/myproject/databases/(default)/documents/mycollection/mydocument' AS document_name,
                                      'UPDATE'                                                                   AS operation,
                                      string_agg(concat(word, word), '')                                         AS data,
                                      'mydocument'                                                               AS document_id
                               FROM   `publicdata.samples.shakespeare`
                        ) SELECT a.*
                 FROM   a,
                        `publicdata.samples.shakespeare` limit 10;


CREATE OR replace TABLE new_stresstest.test_changelog_table AS
                        WITH a          AS
                        (
                               SELECT timestamp_add(current_timestamp(), interval cast(rand() * 1000 AS int64) second)                         AS timestamp,
                                      generate_uuid()                                                            AS event_id,
                                      'projects/myproject/databases/(default)/documents/mycollection/mydocument' AS document_name,
                                      'UPDATE'                                                                   AS operation,
                                      string_agg(concat(word, word), '')                                         AS data,
                                      'mydocument'                                                               AS document_id
                               FROM   `publicdata.samples.shakespeare`
                        ) SELECT a.*
                 FROM   a,
                        `publicdata.samples.shakespeare` limit 20000;