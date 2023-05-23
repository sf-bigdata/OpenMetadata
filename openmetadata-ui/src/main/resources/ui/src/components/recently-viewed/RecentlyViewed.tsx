/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Button, Typography } from 'antd';
import EntityListSkeleton from 'components/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getEntityIcon, getEntityLink } from 'utils/TableUtils';
import { EntityReference } from '../../generated/type/entityReference';
import { getRecentlyViewedData, prepareLabel } from '../../utils/CommonUtils';

const RecentlyViewed: FunctionComponent = () => {
  const { t } = useTranslation();
  const recentlyViewedData = getRecentlyViewedData();
  const [data, setData] = useState<Array<EntityReference>>([]);
  const [isLoading, setIsloading] = useState<boolean>(false);

  const prepareData = () => {
    if (recentlyViewedData.length) {
      setIsloading(true);
      const formattedData = recentlyViewedData
        .map((item) => {
          return {
            serviceType: item.serviceType,
            name: item.displayName || prepareLabel(item.entityType, item.fqn),
            fullyQualifiedName: item.fqn,
            type: item.entityType,
          };
        })
        .filter((item) => item.name);
      setData(formattedData as unknown as EntityReference[]);
      setIsloading(false);
    }
  };

  useEffect(() => {
    prepareData();
  }, []);

  return (
    <EntityListSkeleton
      dataLength={data.length !== 0 ? data.length : 5}
      loading={Boolean(isLoading)}>
      <>
        <Typography.Paragraph className="common-left-panel-card-heading m-b-sm">
          {t('label.recent-views')}
        </Typography.Paragraph>
        <div className="entity-list-body">
          {data.length
            ? data.map((item, index) => {
                return (
                  <div
                    className="flex items-center justify-between"
                    data-testid={`Recently Viewed-${getEntityName(
                      item as unknown as EntityReference
                    )}`}
                    key={index}>
                    <div className="flex items-center">
                      {getEntityIcon(item.type || '')}
                      <Link
                        className="font-medium"
                        to={getEntityLink(
                          item.type || '',
                          item.fullyQualifiedName as string
                        )}>
                        <Button
                          className="entity-button"
                          title={getEntityName(
                            item as unknown as EntityReference
                          )}
                          type="text">
                          <Typography.Text
                            className="w-48 text-left"
                            ellipsis={{ tooltip: true }}>
                            {getEntityName(item as unknown as EntityReference)}
                          </Typography.Text>
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            : t('message.no-recently-viewed-date')}
        </div>
      </>
    </EntityListSkeleton>
  );
};

export default RecentlyViewed;
