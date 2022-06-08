import React, { useState } from 'react';
import { InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Typography, Button, Tooltip, Popover, message } from 'antd';
import styled from 'styled-components/macro';
import moment from 'moment';
import { capitalizeFirstLetterOnly } from '../../../../../shared/textUtil';
import { ANTD_GRAY } from '../../../constants';
import { useEntityData, useRefetch, useEntityUpdate } from '../../../EntityContext';
import analytics, { EventType, EntityActionType } from '../../../../../analytics';
import { EntityHealthStatus } from './EntityHealthStatus';
import { getLocaleTimezone } from '../../../../../shared/time/timeUtils';
import EntityDropdown, { EntityMenuItems } from '../../../EntityDropdown/EntityDropdown';
import PlatformContent from './PlatformContent';
import { getPlatformName } from '../../../utils';
import { useGetAuthenticatedUser } from '../../../../../useGetAuthenticatedUser';
import { EntityType, PlatformPrivileges } from '../../../../../../types.generated';
import EntityCount from './EntityCount';
import EntityName from './EntityName';
import CopyUrn from '../../../../../shared/CopyUrn';

import { GenericEntityUpdate } from '../../../types';

const TitleWrapper = styled.div`
    display: flex;
    justify-content: left;
    align-items: center;

    .ant-typography-edit-content {
        padding-top: 7px;
        margin-left: 15px;
    }
`;

const HeaderContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: space-between;
    margin-bottom: 4px;
`;

const MainHeaderContent = styled.div`
    flex: 1;
    width: 85%;

    .entityCount {
        margin: 5px 0 -4px 0;
    }
`;

const DeprecatedContainer = styled.div`
    width: 110px;
    height: 18px;
    border: 1px solid #ef5b5b;
    border-radius: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #ef5b5b;
    margin-left: 15px;
    padding-top: 12px;
    padding-bottom: 12px;
`;

const DeprecatedText = styled.div`
    color: #ef5b5b;
    margin-left: 5px;
`;

const LastEvaluatedAtLabel = styled.div`
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    color: ${ANTD_GRAY[7]};
`;

const Divider = styled.div`
    border-top: 1px solid #f0f0f0;
    padding-top: 5px;
`;

const SideHeaderContent = styled.div`
    display: flex;
    flex-direction: column;
`;

const TopButtonsWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
`;

const IngestionContainer = styled.div`
    display: flex;
    align-items: baseline;
`;

const IngestionStatus = styled.div`
    margin-right: 8px;
`;

function getCanEditName(entityType: EntityType, privileges?: PlatformPrivileges) {
    switch (entityType) {
        case EntityType.GlossaryTerm:
        case EntityType.GlossaryNode:
            return privileges?.manageGlossaries;
        default:
            return false;
    }
}

type Props = {
    refreshBrowser?: () => void;
    headerDropdownItems?: Set<EntityMenuItems>;
    isNameEditable?: boolean;
};

const INGESTION_ALLOWED_LIST = ['PostgreSQL'];
const INGESTION_REQUESTED_STATUS = 'REQUESTED';

export const EntityHeader = ({ refreshBrowser, headerDropdownItems, isNameEditable }: Props) => {
    const { urn, entityType, entityData } = useEntityData();
    const me = useGetAuthenticatedUser();
    const refetch = useRefetch();
    const [copiedUrn, setCopiedUrn] = useState(false);
    const basePlatformName = getPlatformName(entityData);
    const platformName = capitalizeFirstLetterOnly(basePlatformName);
    const externalUrl = entityData?.externalUrl || undefined;
    const entityCount = entityData?.entityCount;
    const hasExternalUrl = !!externalUrl;
    const description = entityData?.editableProperties?.description || '';
    const isIngestionAllowed = platformName && INGESTION_ALLOWED_LIST.includes(platformName);
    const isIngestionDisabled =
        entityData?.editableProperties?.dataPlatformIngestionStatus === INGESTION_REQUESTED_STATUS;

    const updateEntity = useEntityUpdate<GenericEntityUpdate>();
    const updateDescriptionLegacy = () => {
        return updateEntity?.({
            variables: {
                urn,
                input: {
                    editableProperties: {
                        description,
                        dataPlatformIngestionStatus: INGESTION_REQUESTED_STATUS,
                    },
                },
            },
        });
    };

    const sendAnalytics = () => {
        analytics.event({
            type: EventType.EntityActionEvent,
            actionType: EntityActionType.ClickExternalUrl,
            entityType,
            entityUrn: urn,
        });
    };

    const handleIngestion = async () => {
        message.loading({ content: 'Ingesting...' });
        try {
            if (updateEntity) {
                // Use the legacy update description path.
                await updateDescriptionLegacy();
            }
            message.destroy();
            message.success({ content: 'Ingestion Status Updated', duration: 2 });
        } catch (e: unknown) {
            message.destroy();
            if (e instanceof Error) {
                message.error({ content: `Failed to update description: \n ${e.message || ''}`, duration: 2 });
            }
        }
        refetch?.();
    };

    /**
     * Deprecation Decommission Timestamp
     */
    const localeTimezone = getLocaleTimezone();
    const decommissionTimeLocal =
        (entityData?.deprecation?.decommissionTime &&
            `Scheduled to be decommissioned on ${moment
                .unix(entityData?.deprecation?.decommissionTime)
                .format('DD/MMM/YYYY')} at ${moment
                .unix(entityData?.deprecation?.decommissionTime)
                .format('HH:mm:ss')} (${localeTimezone})`) ||
        undefined;
    const decommissionTimeGMT =
        entityData?.deprecation?.decommissionTime &&
        moment.unix(entityData?.deprecation?.decommissionTime).utc().format('dddd, DD/MMM/YYYY HH:mm:ss z');

    const hasDetails = entityData?.deprecation?.note !== '' || entityData?.deprecation?.decommissionTime !== null;
    const isDividerNeeded = entityData?.deprecation?.note !== '' && entityData?.deprecation?.decommissionTime !== null;
    const canEditName = isNameEditable && getCanEditName(entityType, me?.platformPrivileges as PlatformPrivileges);

    return (
        <HeaderContainer>
            <MainHeaderContent>
                <PlatformContent />
                <TitleWrapper>
                    <EntityName isNameEditable={canEditName} />
                    {entityData?.deprecation?.deprecated && (
                        <Popover
                            overlayStyle={{ maxWidth: 240 }}
                            placement="right"
                            content={
                                hasDetails ? (
                                    <>
                                        {entityData?.deprecation?.note !== '' && (
                                            <Typography.Text>{entityData?.deprecation?.note}</Typography.Text>
                                        )}
                                        {isDividerNeeded && <Divider />}
                                        {entityData?.deprecation?.decommissionTime !== null && (
                                            <Typography.Text type="secondary">
                                                <Tooltip placement="right" title={decommissionTimeGMT}>
                                                    <LastEvaluatedAtLabel>{decommissionTimeLocal}</LastEvaluatedAtLabel>
                                                </Tooltip>
                                            </Typography.Text>
                                        )}
                                    </>
                                ) : (
                                    'No additional details'
                                )
                            }
                        >
                            <DeprecatedContainer>
                                <InfoCircleOutlined />
                                <DeprecatedText>Deprecated</DeprecatedText>
                            </DeprecatedContainer>
                        </Popover>
                    )}
                    {entityData?.health && (
                        <EntityHealthStatus
                            status={entityData?.health.status}
                            message={entityData?.health?.message || undefined}
                        />
                    )}
                </TitleWrapper>
                <EntityCount entityCount={entityCount} />
            </MainHeaderContent>
            <SideHeaderContent>
                <TopButtonsWrapper>
                    <CopyUrn urn={urn} isActive={copiedUrn} onClick={() => setCopiedUrn(true)} />
                    {headerDropdownItems && (
                        <EntityDropdown
                            menuItems={headerDropdownItems}
                            refreshBrowser={refreshBrowser}
                            platformPrivileges={me?.platformPrivileges as PlatformPrivileges}
                        />
                    )}
                </TopButtonsWrapper>
                {isIngestionAllowed && (
                    <IngestionContainer>
                        <IngestionStatus>
                            Ingestion Status : {entityData?.editableProperties?.dataPlatformIngestionStatus || 'NA'}
                        </IngestionStatus>

                        <Button onClick={handleIngestion} disabled={isIngestionDisabled}>
                            Ingest
                            <RightOutlined style={{ fontSize: 12 }} />
                        </Button>
                    </IngestionContainer>
                )}
                {hasExternalUrl && (
                    <Button href={externalUrl} onClick={sendAnalytics}>
                        View in {platformName}
                        <RightOutlined style={{ fontSize: 12 }} />
                    </Button>
                )}
            </SideHeaderContent>
        </HeaderContainer>
    );
};
