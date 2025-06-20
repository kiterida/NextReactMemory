import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { Box, TextField, Switch, Button, Typography } from '@mui/material';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import { supabase } from './supabaseClient';
import MemoryToolbar from './MemoryToolbar';
import CodeSnippet from './CodeSnippet';
import { resolve } from 'path';

const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'left',
    color: theme.palette.text.secondary,
    ...theme.applyStyles('dark', {
        backgroundColor: '#1A2027',
    }),
}));

const MemoryTester = () => {

    const [memoryIndex, setMemoryIndex] = useState('');
    const [memoryItems, setMemoryItems] = useState([]);
    const [showFields, setShowFields] = useState(true); // Toggle for field visibility
    const [currentMemoryName, setCurrentMemoryName] = useState('');
    const [currentMemoryIndex, setCurrentMemoryIndex] = useState(0); // Track the index of the current memory item
    const indexRef = useRef(currentMemoryIndex);
    const [audioOn, setAudioOn] = useState(false);
    const audioRef = useRef(audioOn);
    const [isPlaying, setIsPlaying] = useState(false);
    const playingRef = useRef(isPlaying);
    const [shouldVocalise, setShouldVocalise] = useState(false);
    const [readDescription, setReadDescription] = useState(false);
    const [timerInterval, setTimerInterval] = useState(5000);
    const intervalRef = useRef(timerInterval);
    const [testMode, setTestMode] = useState(true);

    let allowSpeach = false;

    const vocalisePromiseRef = useRef(null); // To track the promise that resolves when speech ends
    const speechInProgress = useRef(false); // To prevent starting a new speech while one is in progress

    const handleSwitchChange = () => {
        console.log("handleSwitchChange");
        setShowFields((prev) => !prev); // Toggle field visibility
    };
    const handleMemoryIndexChange = async (event) => {

     
      //  const newValue = event.target.value;
      const newValue = memoryIndex;

        let memoryIndexes = [];

        if (typeof newValue === 'string') {
            // Normalize input: replace dashes with commas, then split
            const normalized = newValue.replace(/-/g, ',');
            memoryIndexes = normalized
                .split(',')
                .map(val => parseInt(val.trim(), 10))
                .filter(val => !isNaN(val));

            console.log("memoryIndexes - ", memoryIndexes);
            console.log("memoryIndexes length = ", memoryIndexes.length);

            if (memoryIndexes.length > 1) {

                console.log("normalized.length = ", normalized.length)
                const { data, error } = await supabase.rpc('get_nested_items_by_keys', {
                    key1: memoryIndexes[0],  // or whatever value you want
                    key2: memoryIndexes[1]
                });


                if (error) {
                    console.error("Error fetching nested items:", error);
                } else {
                    console.log("Nested items:", data);
                    setMemoryItems(data || []);
                }
            } else {
                memoryIndexes = [newValue];

                console.log("single value");

                if (newValue) {
                    try {
                        // First query: get the root memory item with parent_id null and matching memory_key
                        const { data: rootData, error: rootError } = await supabase
                            .from('memory_items')
                            .select('*')
                            .is('parent_id', null)
                            .eq('memory_key', parseInt(newValue))
                            .single(); // We expect a single row

                        console.log("handleMemoryIndexChange memory_key", newValue);

                        if (rootError) {
                            console.error("Error fetching root memory item:", rootError.message);
                            return;
                        }

                        console.log("Root Memory Item:", rootData);
                        setCurrentMemoryName(rootData.name);

                        if (rootData) {
                            // Second query: get child memory items ordered by memory_key where parent_id equals the id of the root row
                            const { data: childData, error: childError } = await supabase
                                .from('memory_items')
                                .select('*')
                                .eq('parent_id', rootData.id)
                                .order('memory_key', { ascending: true }); // Order by memory_key ascending

                            if (childError) {
                                console.error("Error fetching child memory items:", childError.message);
                            } else {
                                setMemoryItems(childData || []);
                                console.log("Ordered Child Memory Items:", childData);
                            }
                        } else {
                            setMemoryItems([]);
                        }
                    } catch (error) {
                        console.error("Unexpected error:", error);
                    }
                } else {
                    setMemoryItems([]);
                }
            }

        } else if (typeof newValue === 'number') {
            console.log("typeof = number");
        }

        console.log("Final memoryIndexes array:", memoryIndexes);
        setMemoryIndex(newValue);
        console.log("Memory Index:", newValue);


    };

    const toggleReadDescription = (readDescription) => {
        setReadDescription(readDescription);
    }





    const handlePreviousMemoryItem = () => {
        setCurrentMemoryIndex((prevIndex) => {
            const nextIndex = prevIndex - 1;
            if (nextIndex >= memoryItems.length) {
                return 0; // Loop back to the first item if it's the last one
            }
            return nextIndex;
        });
    };

    let currentMemoryItem = memoryItems[currentMemoryIndex] || {}; // Current item to display

    const onToggleAudioOn = () => {
        setAudioOn(!audioOn);
        console.log('recieved toggle');
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const readCurrent = async () => {

        console.log("readCurrent: ", indexRef.current);
        currentMemoryItem = memoryItems[indexRef.current] || {};

        //await speak(testMode ? "test mode" : "learn mode");

        await speak(currentMemoryItem.memory_key);

        if(testMode){
            await sleep(intervalRef.current);
        }else{

        }

        

        await speak(currentMemoryItem.name);

        if(readDescription)
            await speak(currentMemoryItem.description);

        if(!testMode)
            await sleep(intervalRef.current);

        resolve();

    }

    useEffect(() =>{
        indexRef.current = currentMemoryIndex;
        console.log("currentMemoryIndex: ", currentMemoryIndex);
        if(playingRef.current)
            playBack();
    }, [currentMemoryIndex])

    useEffect(()=>{
        audioRef.current = audioOn;
       
        intervalRef.current = timerInterval;
       
        console.log("Player: ", isPlaying ? "On" : "Off");
        console.log("Audio: ",  audioOn ? "On" : "Off");
        if(!audioOn)
            window.speechSynthesis.cancel();
    }, [audioOn, timerInterval])

    useEffect(()=>{
         playingRef.current = isPlaying;
    }, [isPlaying])

    const playBack = async () => {
        
        console.log("!!!playingRef: ", playingRef);
      
        await readCurrent();
        handleNextMemoryItem();

    }

    const onPlayStateChange = (playing) => {

        setIsPlaying(playing);

        audioRef.current = playing;

        if (playing){
            playBack();
        }
        else{
            console.log("Cancelling speach!");
            window.speechSynthesis.cancel();
        }
            

        // speak("test");

        console.log("Recieved play state change from toolbar: ", playing)
    }



    const vocalise = useCallback((memIndex, timerInterval) => {
        return new Promise((resolve) => {
            if (!audioOn) return resolve();

            const currentMemoryItem = memoryItems[memIndex] || {};
            const delayBetweenParts = timerInterval; // ⏱️ Delay in milliseconds (make configurable later)

            // const speak = (text) => {
            //   return new Promise((res) => {
            //     const utterance = new SpeechSynthesisUtterance(text);

            //     utterance.onend = () => {
            //       console.log(`✅ Speech ended for: "${text}"`);
            //       res();
            //     };

            //     utterance.onerror = (e) => {
            //       console.error("❌ Speech error:", e);
            //       res(); // Still resolve to continue flow
            //     };

            //     window.speechSynthesis.speak(utterance);
            //   });
            // };

            (async () => {

         

                console.log("🔊 Speaking memory_key:", currentMemoryItem.memory_key);
                await speak(currentMemoryItem.memory_key);

                

                console.log(`⏸️ Waiting ${delayBetweenParts}ms...`);
                await new Promise((res) => setTimeout(res, delayBetweenParts));

                console.log("🔊 Speaking name:", currentMemoryItem.name);
                await speak(currentMemoryItem.name);

                console.log("description = ", currentMemoryItem.description);
                if (currentMemoryItem.description)
                    await speak(currentMemoryItem.description);

                if (currentMemoryItem.code_snippet)
                    await speak(currentMemoryItem.code_snippet);

                resolve(); // ✅ Done after both speeches
            })();
        });
    }, [audioOn, memoryItems]);


    const handleNextMemoryItem = () => {
        const nextIndex = (currentMemoryIndex + 1) % memoryItems.length;
        setCurrentMemoryIndex(nextIndex); // Then move to next
    }
    // const handleNextMemoryItem = useCallback(async (timerInterval) => {
    //     const nextIndex = (currentMemoryIndex + 1) % memoryItems.length;

    //     setCurrentMemoryIndex(nextIndex); // Then move to next
    //     await vocalise(nextIndex, timerInterval); // Wait for speech first
    // }, [currentMemoryIndex, memoryItems, vocalise]);

    const speak = (text) => {
        return new Promise((res) => {

            if (!audioRef.current){
                return res();
            }else{
                console.log("Allowed to speak");
            }

            // if(!allowSpeach)
            // {
            //     console.log("Speak function interupted.");
            //     return res();
                
            // }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US'; // Set the language
            utterance.volume = 1; // Set volume (0.0 to 1.0)
            utterance.rate = 1.0; // Increase rate for faster speech
            utterance.pitch = 1; // Set pitch (default is 1)

            // Use the first available voice as a default
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                utterance.voice = voices[0];
            }

            utterance.onend = () => {
                console.log(`✅ Speech ended for: "${text}"`);
                res();
            };

            utterance.onerror = (e) => {
                console.error("❌ Speech error:", e);
                res(); // Still resolve to continue flow
            };

            console.log("speaking");
            window.speechSynthesis.speak(utterance);
        });
    };


    const onTimerIntervalChange = (newInterval) => {

        setTimerInterval(newInterval);
        console.log("Timer Interval Changed to : ", newInterval);
    }

    const onToggleReadDetails = (readDetails) => {
        setReadDescription(readDetails);
    }

    const onToggleTestMode = (testMode) => {
        setTestMode(testMode);
        console.log("onToggleTestMode: ", testMode);
    }


    return (
        <>
            
              
               
         

            <Box sx={{ flexGrow: 1 }}>
                <Grid container spacing={2}>
                    <Grid container spacing={2}>

                        { /* conditional rendering */}
                        {showFields && (<Grid size={{ xs: 12, md: 6 }}>

                            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <TextField
                                    id="memoryIndexTextField"
                                    label="Memory Index"
                                    variant="outlined"
                                    value={memoryIndex}
                                    onChange={(e) => setMemoryIndex(e.target.value)}
                                    fullWidth
                                />
                                <Button onClick={handleMemoryIndexChange}>Go</Button>
                            </Box>
                        </Grid>)}


                        {showFields && (
                            <Grid size={{ xs: 12, md: 6 }}>

                                <Box sx={{ display: 'flex' }}>
                                    <TextField
                                        id="memoryNameField"
                                        label="Memory Name"
                                        variant="outlined"
                                        value={currentMemoryName}
                                        onChange={(event) => setCurrentMemoryName(event.target.value)}
                                        fullWidth
                                    />
                                </Box>

                            </Grid>
                        )}





                        <Grid size={{ xs: 12, md: 12 }}>
                            {/* <Item sx={{ height: "160px" }}> */}
                                {memoryItems.length > 0 ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            height: '100%',
                                        }}
                                    >
                                <TextField
                                    label="Memory"
                                    value={`${currentMemoryItem.memory_key} - ${currentMemoryItem.name}`}
                                    fullWidth
                                    multiline
                                    rows={4}
                                    margin="normal"
                                />
                                        
                                        <Button
                                            variant="contained"
                                            onClick={handleNextMemoryItem}
                                            sx={{
                                                display: 'default',
                                                marginTop: 'auto',
                                                width: '100%',
                                            }}
                                        >
                                            Next
                                        </Button>
                                    </Box>

                                ) : (
                                    <div>No memory items found</div>
                                )}
                            {/* </Item> */}
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <MemoryToolbar
                                toolBarProgress={currentMemoryIndex}      // number for the progress bar
                                toolBarRange={memoryItems.length}
                                // isPlaying={isPlaying}                  // boolean to determine play/pause icon
                                // onTogglePlay={handleTogglePlay}        // function to handle play/pause toggle
                                onNext={handleNextMemoryItem}             // function to go to the next item
                                onBack={handlePreviousMemoryItem}         // function to go back
                                onHandleSwitch={handleSwitchChange}
                                onToggleAudio={onToggleAudioOn}
                                onPlayChange={onPlayStateChange}
                                onTimerChange={onTimerIntervalChange}
                                onToggleReadDetails={onToggleReadDetails}
                                onToggleTestMode={onToggleTestMode}
                            />
                        </Grid>

                        {showFields && (
                            <Grid size={{ xs: 12, md: 12 }}>

                                <TextField
                                    label="Description"
                                    value={currentMemoryItem.description || ''}
                                    fullWidth
                                    multiline
                                    rows={4}
                                    margin="normal"
                                />

                            </Grid>
                        )}

                        {showFields && (
                            <Grid size={{ xs: 12, md: 12 }}>

                                <CodeSnippet code={currentMemoryItem.code_snippet || ''} />



                            </Grid>
                        )}
                        <Grid xs={12}>
                             <button onClick={() => { window.speechSynthesis.cancel(); }}>Cancel SpeechSynthesisUtterance</button>
                            <Item>To Do : React Native App that can be controlled by earbuds</Item>
                        </Grid>
                    </Grid>
                </Grid>
            </Box>
        </>
    )
}

export default MemoryTester;