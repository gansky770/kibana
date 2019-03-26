/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';

import { timelineQuery } from '../../../../plugins/secops/public/containers/timeline/index.gql_query';
import { Direction, GetTimelineQuery } from '../../../../plugins/secops/public/graphql/types';
import { KbnTestProvider } from './types';

const LTE = new Date('3000-01-01T00:00:00.000Z').valueOf();
const GTE = new Date('2000-01-01T00:00:00.000Z').valueOf();

// typical values that have to change after an update from "scripts/es_archiver"
const HOST_NAME = 'suricata-sensor-amsterdam';
const TOTAL_COUNT = 96;
const EDGE_LENGTH = 2;
const CURSOR_ID = '1550608949681';

const FILTER_VALUE = {
  bool: {
    filter: [
      {
        bool: {
          should: [{ match_phrase: { 'host.name': HOST_NAME } }],
          minimum_should_match: 1,
        },
      },
      {
        bool: {
          filter: [
            {
              bool: {
                should: [{ range: { '@timestamp': { gte: GTE } } }],
                minimum_should_match: 1,
              },
            },
            {
              bool: {
                should: [{ range: { '@timestamp': { lte: LTE } } }],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
    ],
  },
};

const timelineTests: KbnTestProvider = ({ getService }) => {
  const esArchiver = getService('esArchiver');
  const client = getService('secOpsGraphQLClient');

  describe('events', () => {
    before(() => esArchiver.load('auditbeat/hosts'));
    after(() => esArchiver.unload('auditbeat/hosts'));

    it('Make sure that we get Timeline data', () => {
      return client
        .query<GetTimelineQuery.Query>({
          query: timelineQuery,
          variables: {
            sourceId: 'default',
            filterQuery: JSON.stringify(FILTER_VALUE),
            pagination: {
              limit: 2,
              cursor: null,
              tiebreaker: null,
            },
            sortField: {
              sortFieldId: 'timestamp',
              direction: Direction.desc,
            },
          },
        })
        .then(resp => {
          const events = resp.data.source.Events;
          expect(events.edges.length).to.be(EDGE_LENGTH);
          expect(events.totalCount).to.be(TOTAL_COUNT);
          expect(events.pageInfo.endCursor!.value).to.equal(CURSOR_ID);
        });
    });

    it('Make sure that pagination is working in Timeline query', () => {
      return client
        .query<GetTimelineQuery.Query>({
          query: timelineQuery,
          variables: {
            sourceId: 'default',
            filterQuery: JSON.stringify(FILTER_VALUE),
            pagination: {
              limit: 2,
              cursor: CURSOR_ID,
              tiebreaker: '191',
            },
            sortField: {
              sortFieldId: 'timestamp',
              direction: Direction.desc,
            },
          },
        })
        .then(resp => {
          const events = resp.data.source.Events;

          expect(events.edges.length).to.be(EDGE_LENGTH);
          expect(events.totalCount).to.be(TOTAL_COUNT);
          expect(events.edges[0]!.node.host!.name).to.be(HOST_NAME);
        });
    });
  });
};

// tslint:disable-next-line no-default-export
export default timelineTests;
