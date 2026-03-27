import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography, Spacing } from '../theme';

interface ProgressRingProps {
  progress: number;      // 0-1
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  centerText?: string;
  centerSubText?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color = Colors.accent,
  bgColor = Colors.cardLight,
  label,
  centerText,
  centerSubText,
}: ProgressRingProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: clampedProgress,
      tension: 30,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </Svg>
        {/* Center content */}
        <View style={[styles.center, { width: size, height: size }]}>
          {centerText && (
            <Text style={[styles.centerText, { fontSize: size * 0.18 }]}>{centerText}</Text>
          )}
          {centerSubText && (
            <Text style={[styles.centerSubText, { fontSize: size * 0.1 }]}>{centerSubText}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontWeight: '800',
    color: Colors.text,
  },
  centerSubText: {
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
