import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Switch,
  Tooltip,
  LinearProgress,
  Typography,
  ButtonGroup,
  Button,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import PropTypes from 'prop-types';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import TimerIcon from '@mui/icons-material/Timer';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VoiceOverOffIcon from '@mui/icons-material/VoiceOverOff';
import ChromeReaderModeIcon from '@mui/icons-material/ChromeReaderMode';

function LinearProgressWithLabel(props) {
    const progressCount = props.itemCount || 1; // Default to 1 if itemCount is 0 or undefined
    const progressConverted = (props.value / progressCount) * 100;
  

  //  console.log("Progress converted:", progressConverted);
  //  console.log("Props:", props);
  
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress variant="determinate" value={progressConverted} />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {`${Math.round(progressConverted)}%`}
          </Typography>
        </Box>
      </Box>
    );
  }
  

LinearProgressWithLabel.propTypes = {
  value: PropTypes.number.isRequired,
};

const MemoryToolbar = ({
  toolBarProgress,
  toolBarRange,
  isPlaying,
  onNext,
  onBack,
  onShowHideToggle,
  showHideValue,
  onHandleSwitch,
  onToggleAudio,
  onPlayChange,
  onTimerChange,
  onToggleReadDetails,
}) => {
  const [progress, setProgress] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [timerAnchorEl, setTimerAnchorEl] = useState(null);
  const [timerInterval, setTimerInterval] = useState(5000); // Default to 5 seconds
  const [timerId, setTimerId] = useState(null);
  const [progressCount, setProgressCount] = useState(100);
  const [audioOn, setAudioOn] = useState(false);
  const intervalRef = useRef(null); // useRef is better for interval IDs
  const timeoutRef = useRef(null); // 👈 this is where you define it

  const loopRef = useRef(false); // Reference to track whether the loop is active

  const onNextRef = useRef(onNext);

      const [readDetails, setReadDetails] = useState(false); // Add this to your component state

const handleToggleReadDetails = () => {
  setReadDetails((prev) => !prev);
  onToggleReadDetails(!readDetails);
};

useEffect(() => {
  onNextRef.current = onNext; // Keep the latest function
}, [onNext]);


    // console.log("toolBarRange", toolBarRange)


  const handleToggleAudio = () => {
    setAudioOn(!audioOn);

    onToggleAudio();
    // console.log("Audio On: ", audioOn)
  }

  const onHandleNext = async () => {
    await onNext();
  };

  const onSwitchChange = () => {
    onHandleSwitch();
  };

  const handleTimerClick = (event) => {
    setTimerAnchorEl(event.currentTarget);
  };

  const handleTimerClose = (interval) => {
    setTimerAnchorEl(null);
    if (interval) {
      onTimerChange(interval);
      setTimerInterval(interval); // Set selected interval
    }
  };

  const handleTogglePlay = () => {
    setPlaying(!playing);

    onPlayChange(!playing);
    // console.log("setPlaying", !playing);
  };

  // useEffect(() => {
  //   let cancelled = false;
  
  //   const loop = async () => {
  //     if (cancelled) return;
  
  //     console.log("calling await onNext()");
  //     await onNextRef.current(timerInterval); // ← Use the ref instead of the dependency
  //     console.log("next line after await onNext()");
  
  //     if (cancelled) return;
  
  //     timeoutRef.current = setTimeout(() => {
  //       if (!cancelled) {
  //         console.log("loop() called inside setTimeout with timerInterval", timerInterval);
  //         loop();
  //       }
  //     }, timerInterval);
  //   };
  
  //   if (playing) {
  //     loop();
  //   }
  
  //   return () => {
  //     cancelled = true;
  //     clearTimeout(timeoutRef.current);
  //   };
  // }, [playing, timerInterval]); // ✅ `onNext` is removed from dependencies
  
 

  useEffect(() => {
    setProgressCount(progressCount);
    setProgress(toolBarProgress);
  }, [toolBarProgress, toolBarProgress]);

  return (
    <Box sx={{ padding: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      {/* Show/Hide Switch with Tooltip */}
      <Tooltip title="Show/Hide">
        <Switch checked={showHideValue} onChange={onSwitchChange} />
      </Tooltip>

      {/* Button Group for Back, Play/Pause, Next */}
      <ButtonGroup variant="contained" sx={{ marginTop: 1, marginBottom: 1 }}>
        <Button onClick={onBack}>
          <ArrowBackIosNewIcon />
        </Button>
        <Button onClick={handleTogglePlay}>
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </Button>
        <Button onClick={onHandleNext}>
          <ArrowForwardIosIcon />
        </Button>
      </ButtonGroup>

     
      <Tooltip title="Speech on/off">
      <Button onClick={handleToggleAudio}>
        
        {audioOn ? <RecordVoiceOverIcon />  : <VoiceOverOffIcon />}     
      </Button>
      </Tooltip>
      
      {/* Timer Button */}
      <IconButton onClick={handleTimerClick}>
        <TimerIcon />
      </IconButton>

    
      <Menu
        anchorEl={timerAnchorEl}
        open={Boolean(timerAnchorEl)}
        onClose={() => handleTimerClose()}
      >
        <MenuItem onClick={() => handleTimerClose(5000)}>5 seconds</MenuItem>
        <MenuItem onClick={() => handleTimerClose(4000)}>4 seconds</MenuItem>
        <MenuItem onClick={() => handleTimerClose(3000)}>3 seconds</MenuItem>
        <MenuItem onClick={() => handleTimerClose(2000)}>2 seconds</MenuItem>
        <MenuItem onClick={() => handleTimerClose(1000)}>1 seconds</MenuItem>
        <MenuItem onClick={() => handleTimerClose(500)}>0.5 seconds</MenuItem>
      </Menu>
   
 {/* "Read Details" Toggle Button */}
    <Tooltip title="Toggle Read Details">
      <Button onClick={handleToggleReadDetails}>
        <ChromeReaderModeIcon color={readDetails ? 'primary' : 'disabled'} />
        &nbsp;Read Details
      </Button>
    </Tooltip>
      


      {/* Linear Progress Bar */}
      <Box sx={{ width: '100%', marginTop: 2 }}>
        <LinearProgressWithLabel value={progress} itemCount={toolBarRange} />
      </Box>
    </Box>
  );
};

export default MemoryToolbar;
