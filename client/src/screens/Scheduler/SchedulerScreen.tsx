import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { StateWrapper } from '../../components/StateWrapper';
import { CalendarView } from '../../components/CalendarView';
import {
  schedulerService,
  Meeting,
  CreateMeetingDto,
} from '../../services/schedulerService';

export interface SchedulerScreenProps {
  projectId?: string;
  onMeetingConfirmed?: (meeting: Meeting) => void;
  navigation?: any;
}

export const SchedulerScreen: React.FC<SchedulerScreenProps> = ({
  projectId = 'project-1',
  onMeetingConfirmed,
  navigation: propNavigation,
}) => {
  const contextNavigation = React.useContext(NavigationContext);
  const navigation = propNavigation || contextNavigation;
  const { colors, typography, spacing } = useTheme();

  const [viewMode, setViewMode] = useState<'CALENDAR' | 'MEETINGS'>('MEETINGS');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'VOTING' | 'CONFIRMED'>('ALL');

  // Propose Modal State
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [slot1Start, setSlot1Start] = useState<string>('2026-09-15T10:00:00Z');
  const [slot1End] = useState<string>('2026-09-15T11:00:00Z');
  const [slot2Start, setSlot2Start] = useState<string>('2026-09-15T14:00:00Z');
  const [slot2End] = useState<string>('2026-09-15T15:00:00Z');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadMeetings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await schedulerService.getProjectMeetings(projectId);
      setMeetings(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load project meetings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    schedulerService
      .getProjectMeetings(projectId)
      .then((data) => {
        if (isMounted) {
          setMeetings(data || []);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load project meetings');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleVote = async (meetingId: string, slotId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // safe fallback
      }
    }

    // Optimistic UI update
    setMeetings((prevMeetings) =>
      prevMeetings.map((m) => {
        if (m.id !== meetingId) return m;
        const updatedSlots = m.slots.map((s) => {
          if (s.id !== slotId) return s;
          const currentCount = s.voteCount || 0;
          const hasVoted = !!s.hasVoted;
          return {
            ...s,
            hasVoted: !hasVoted,
            voteCount: hasVoted ? Math.max(0, currentCount - 1) : currentCount + 1,
          };
        });
        return { ...m, slots: updatedSlots };
      })
    );

    try {
      await schedulerService.voteSlot(meetingId, slotId);
    } catch {
      // Silent catch or rollback if needed
    }
  };

  const handleConfirmSlot = async (meetingId: string, slotId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // safe fallback
      }
    }

    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== meetingId) return m;
        const selectedSlot = m.slots.find((s) => s.id === slotId);
        const updatedMeeting: Meeting = {
          ...m,
          status: 'CONFIRMED',
          selectedSlotId: slotId,
          selectedSlot,
        };
        if (onMeetingConfirmed) {
          onMeetingConfirmed(updatedMeeting);
        }
        return updatedMeeting;
      })
    );

    try {
      await schedulerService.confirmMeetingSlot(meetingId, slotId);
    } catch {
      // Silent catch
    }
  };

  const handleProposeMeeting = async () => {
    if (!newTitle.trim()) {
      setFormError('Please enter a meeting title.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // safe fallback
      }
    }

    const dto: CreateMeetingDto = {
      projectId,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      slots: [
        { startTime: slot1Start, endTime: slot1End },
        { startTime: slot2Start, endTime: slot2End },
      ],
    };

    try {
      const created = await schedulerService.createMeeting(dto);
      setMeetings((prev) => [created, ...prev]);
      setIsModalVisible(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create meeting proposal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (filter === 'VOTING') return m.status === 'VOTING';
    if (filter === 'CONFIRMED') return m.status === 'CONFIRMED';
    return true;
  });

  const formatSlotTime = (isoStart: string, isoEnd: string) => {
    try {
      const start = new Date(isoStart);
      const end = new Date(isoEnd);
      const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const startTimeStr = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTimeStr = end.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} • ${startTimeStr} - ${endTimeStr}`;
    } catch {
      return `${isoStart} - ${isoEnd}`;
    }
  };

  if (isLoading && viewMode === 'MEETINGS') {
    return <StateWrapper state="loading" />;
  }

  if (error && viewMode === 'MEETINGS') {
    return <StateWrapper state="error" errorMessage={error} onRetry={loadMeetings} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title="Calendar & Meetings"
        subtitle="Standups, deadlines & team schedule"
        showBack={Boolean(navigation)}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainApp', { screen: 'More' });
          }
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Mode Switcher */}
        <View style={[styles.modeSwitcherRow, { marginBottom: spacing.sm }]}>
          <Chip
            label="📅 Calendar & Deadlines"
            selected={viewMode === 'CALENDAR'}
            onPress={() => setViewMode('CALENDAR')}
          />
          <View style={{ width: spacing.xs }} />
          <Chip
            label="🤝 Meeting Proposals"
            selected={viewMode === 'MEETINGS'}
            onPress={() => setViewMode('MEETINGS')}
          />
        </View>

        {viewMode === 'CALENDAR' ? (
          <CalendarView projectId={projectId} />
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
                  ]}
                >
                  Meeting Scheduler
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 }}>
                  Propose slots, collect votes, and confirm team meetings.
                </Text>
              </View>

              <Button
                title="+ Propose"
                onPress={() => setIsModalVisible(true)}
                size="sm"
                style={{ minWidth: 96, alignSelf: 'center' }}
              />
            </View>

          {/* Filter Chips */}
          <View style={[styles.filterRow, { marginVertical: spacing.md }]}>
        <Chip
          label={`All (${meetings.length})`}
          selected={filter === 'ALL'}
          onPress={() => setFilter('ALL')}
        />
        <View style={{ width: spacing.xs }} />
        <Chip
          label="Voting"
          selected={filter === 'VOTING'}
          onPress={() => setFilter('VOTING')}
        />
        <View style={{ width: spacing.xs }} />
        <Chip
          label="Confirmed"
          selected={filter === 'CONFIRMED'}
          onPress={() => setFilter('CONFIRMED')}
        />
      </View>

      {/* Content List / Empty State */}
      {filteredMeetings.length === 0 ? (
        <StateWrapper
          state="empty"
          emptyTitle="No Meetings Scheduled"
          emptySubtitle="Propose candidate time slots for your team to vote on."
          emptyActionLabel="+ Propose Meeting"
          onEmptyAction={() => setIsModalVisible(true)}
        />
      ) : (
        <FlatList
          data={filteredMeetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item: meeting }) => {
            const isConfirmed = meeting.status === 'CONFIRMED';
            return (
              <Card style={styles.meetingCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.meetingTitle,
                        { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                      ]}
                    >
                      {meeting.title}
                    </Text>
                    {meeting.description ? (
                      <Text
                        style={[
                          styles.meetingDesc,
                          { color: colors.onSurfaceVariant, marginTop: 2 },
                        ]}
                      >
                        {meeting.description}
                      </Text>
                    ) : null}
                  </View>

                  <Badge
                    label={meeting.status}
                    variant={isConfirmed ? 'secondary' : 'primary'}
                  />
                </View>

                {isConfirmed && meeting.selectedSlot && (
                  <View style={[styles.confirmedBanner, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>✅</Text>
                    <Text style={{ color: colors.primary, fontWeight: '600', flex: 1 }}>
                      Confirmed: {formatSlotTime(meeting.selectedSlot.startTime, meeting.selectedSlot.endTime)}
                    </Text>
                  </View>
                )}

                {/* Slots Voting Section */}
                <Text
                  style={[
                    styles.slotsHeaderTitle,
                    { color: colors.onSurfaceVariant, marginTop: spacing.sm },
                  ]}
                >
                  Candidate Time Slots:
                </Text>

                {meeting.slots.map((slot) => {
                  const isSelected = meeting.selectedSlotId === slot.id;
                  const voteCount = slot.voteCount || (slot.votes ? slot.votes.length : 0);
                  const hasVoted = !!slot.hasVoted;

                  return (
                    <View
                      key={slot.id}
                      testID={`meeting-slot-${slot.id}`}
                      style={[
                        styles.slotCard,
                        {
                          borderColor: isSelected
                            ? colors.primary
                            : colors.outlineVariant,
                          backgroundColor: isSelected
                            ? colors.surfaceVariant
                            : colors.surface,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.slotTimeText,
                            {
                              color: colors.onSurface,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          📅 {formatSlotTime(slot.startTime, slot.endTime)}
                        </Text>
                        <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>
                          {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                        </Text>
                      </View>

                      {!isConfirmed ? (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <TouchableOpacity
                            testID={`vote-btn-${slot.id}`}
                            onPress={() => handleVote(meeting.id, slot.id)}
                            style={[
                              styles.voteButton,
                              {
                                backgroundColor: hasVoted ? colors.primary : colors.surfaceVariant,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: hasVoted ? colors.onPrimary : colors.primary,
                                fontWeight: '600',
                                fontSize: 13,
                              }}
                            >
                              {hasVoted ? '✓ Voted' : 'Vote'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            testID={`confirm-btn-${slot.id}`}
                            onPress={() => handleConfirmSlot(meeting.id, slot.id)}
                            style={[
                              styles.confirmButton,
                              { backgroundColor: colors.secondary },
                            ]}
                          >
                            <Text style={{ color: colors.onSecondary, fontWeight: '600', fontSize: 12 }}>
                              Confirm
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        isSelected && (
                          <Badge label="Selected Slot" variant="secondary" />
                        )
                      )}
                    </View>
                  );
                })}
              </Card>
            );
          }}
        />
      )}

      {/* Propose Meeting Slot Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                ]}
              >
                Propose Meeting Slots
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm }}>
              {formError ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer }]}>
                  <Text style={{ color: colors.error }}>{formError}</Text>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Meeting Title</Text>
              <TextInput
                testID="input-meeting-title"
                style={[
                  styles.input,
                  {
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="e.g. Sprint Planning & Architecture Review"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Description (Optional)</Text>
              <TextInput
                testID="input-meeting-desc"
                style={[
                  styles.input,
                  {
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="Agendas, preparation links..."
                placeholderTextColor={colors.onSurfaceVariant}
                value={newDescription}
                onChangeText={setNewDescription}
              />

              <Text style={[styles.fieldLabel, { color: colors.onSurface, marginTop: spacing.sm }]}>
                Slot 1 (ISO Start & End)
              </Text>
              <TextInput
                testID="input-slot1-start"
                style={[
                  styles.input,
                  {
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.background,
                  },
                ]}
                value={slot1Start}
                onChangeText={setSlot1Start}
              />

              <Text style={[styles.fieldLabel, { color: colors.onSurface, marginTop: spacing.sm }]}>
                Slot 2 (ISO Start & End)
              </Text>
              <TextInput
                testID="input-slot2-start"
                style={[
                  styles.input,
                  {
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.background,
                  },
                ]}
                value={slot2Start}
                onChangeText={setSlot2Start}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button
                  testID="submit-propose-btn"
                  title={isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                  onPress={handleProposeMeeting}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
        </>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  modeSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingCard: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  meetingTitle: {
    fontWeight: '700',
  },
  meetingDesc: {
    fontSize: 13,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  slotsHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  slotCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  slotTimeText: {
    fontSize: 14,
  },
  voteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confirmButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontWeight: '700',
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
});
