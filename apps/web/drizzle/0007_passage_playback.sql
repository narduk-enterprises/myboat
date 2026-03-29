ALTER TABLE passages ADD COLUMN start_place_label text;
ALTER TABLE passages ADD COLUMN end_place_label text;
ALTER TABLE passages ADD COLUMN playback_json text;

CREATE TABLE passage_ais_vessels (
  passage_id text NOT NULL REFERENCES passages(id) ON DELETE cascade,
  mmsi text NOT NULL,
  profile_json text NOT NULL,
  samples_json text NOT NULL,
  PRIMARY KEY(passage_id, mmsi)
);

CREATE INDEX passage_ais_vessels_passage_idx ON passage_ais_vessels (passage_id);
