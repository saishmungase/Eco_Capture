import { useState, useRef } from "react"
import { Upload, Camera, Leaf, ExternalLink, MapPin, X, AlertCircle, Loader2, CheckCircle, XCircle } from "lucide-react"

const MotionDiv = ({ children, className, initial, animate, exit, transition, whileHover, whileTap, onClick, ...props }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isTapped, setIsTapped] = useState(false)
  
  const getTransform = () => {
    if (isTapped && whileTap?.scale) return `scale(${whileTap.scale})`
    if (isHovered && whileHover?.scale) return `scale(${whileHover.scale})`
    return 'scale(1)'
  }
  
  return (
    <div
      className={className}
      style={{ transform: getTransform(), transition: 'all 0.2s ease' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsTapped(true)}
      onMouseUp={() => setIsTapped(false)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export default function EcoCapturePage() {
  const [step, setStep] = useState("upload")
  const [showUploadOptions, setShowUploadOptions] = useState(false)
  const [result, setResult] = useState(null)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const [capturedImage, setCapturedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleFileSelect = async (file) => {
    setShowUploadOptions(false)
    setStep("loading")

    const reader = new FileReader()
    reader.onload = (e) => setCapturedImage(e.target?.result)
    reader.readAsDataURL(file)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("https://eco-capture.onrender.com/predict", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setStep("result")
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to analyze image. Please try again.")
      setStep("upload")
    }
  }

  const handleAlternativeSelect = async (object) => {
    setShowAlternatives(false)
    setStep("loading")

    try {
      const response = await fetch("https://eco-capture.onrender.com/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: result.id,
          product: object,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setStep("result")
    } catch (error) {
      console.error("Error updating product:", error)
      alert("Failed to update product. Please try again.")
      setStep("result")
      setShowAlternatives(true)
    }
  }

  const resetApp = () => {
    setStep("upload")
    setResult(null)
    setCapturedImage(null)
    setCustomInput("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
      {step === "upload" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
          <div className="mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl">
              <Leaf className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-center bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            EcoCapture
          </h1>

          <p className="text-base sm:text-lg text-gray-700 text-center mb-12 max-w-xl px-4 leading-relaxed">
            Snap a photo of any object and discover if it's recyclable. Get instant recycling tips and find nearby
            disposal locations.
          </p>

          <MotionDiv whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <button
              onClick={() => setShowUploadOptions(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-10 py-5 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center gap-3"
            >
              <Upload className="w-6 h-6" />
              Upload Image
            </button>
          </MotionDiv>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />

          {showUploadOptions && (
            <>
              <div
                className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                onClick={() => setShowUploadOptions(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 z-50 shadow-2xl sm:max-w-md sm:mx-auto sm:left-1/2 sm:-translate-x-1/2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-5 text-center text-gray-900">Choose an option</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-3 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-green-100 text-gray-900 py-4 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-green-200 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    Choose from Files
                  </button>
                  <button
                    onClick={() => setShowUploadOptions(false)}
                    className="w-full bg-gray-200 text-gray-800 py-4 rounded-2xl font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="animate-spin">
            <Loader2 className="w-16 h-16 text-green-600" />
          </div>
          <p className="mt-6 text-gray-800 text-xl font-medium">
            Analyzing your image...
          </p>
        </div>
      )}

      {step === "result" && result && (
        <div className="min-h-screen pb-20">
          {/* Header */}
          <div className="bg-white/90 border-b border-gray-200 sticky top-0 z-30 backdrop-blur-lg shadow-sm">
            <div className="px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between w-full">
              <button onClick={resetApp} className="text-gray-700 hover:text-gray-900 transition-colors">
                <X className="w-6 h-6" />
              </button>
              <h2 className="font-semibold text-xl text-gray-900">Results</h2>
              <div className="w-6" />
            </div>
          </div>

          <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Product Name */}
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 px-4">{result.product}</h1>
              <button
                onClick={() => setShowAlternatives(true)}
                className="text-green-600 bg-green-50 px-5 py-2.5 rounded-full text-base flex items-center gap-2 mx-auto hover:bg-green-100 font-medium transition-colors border border-green-200"
              >
                <AlertCircle className="w-5 h-5" />
                Not the correct product?
              </button>
              <p className="text-gray-700 text-base mt-3 font-medium">
                {(result.probability * 100).toFixed(0)}% confidence
              </p>
            </div>

            {/* Image */}
            {capturedImage && (
              <div className="rounded-3xl overflow-hidden shadow-2xl w-full mx-auto max-w-5xl">
                <img
                  src={capturedImage}
                  alt={result.product}
                  className="w-full h-72 sm:h-96 lg:h-[500px] object-cover"
                />
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg border border-gray-200 w-full mx-auto max-w-5xl">
              <p className="text-base sm:text-lg lg:text-xl text-gray-800 leading-relaxed">{result.description}</p>
            </div>

            {/* Recyclable Status */}
            <div className={`rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg w-full mx-auto max-w-5xl ${
              result.recyclable === "yes"
                ? "bg-green-100 border-2 border-green-300"
                : "bg-red-100 border-2 border-red-300"
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.recyclable === "yes" ? (
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-700" />
                ) : (
                  <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-700" />
                )}
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                  {result.recyclable === "yes" ? "Recyclable!" : "Not Recyclable"}
                </h3>
              </div>
              <p className="text-base sm:text-lg lg:text-xl text-gray-800">
                {result.recyclable === "yes"
                  ? "This item can be recycled. Check out the videos below for tips!"
                  : "This item cannot be recycled through standard programs."}
              </p>
            </div>

            {/* YouTube Videos */}
            {result.yt.length > 0 && (
              <div className="w-full mx-auto max-w-7xl">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 flex items-center gap-3 text-gray-900">
                  <ExternalLink className="w-7 h-7 lg:w-8 lg:h-8 text-green-600" />
                  Recycling Tutorials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                  {result.yt.map((video, index) => {
                    // Extract video ID ONLY for fetching thumbnail (not for URL)
                    const getYouTubeVideoId = (url) => {
                      if (!url) return null
                      try {
                        // Handle youtube.com/watch?v=VIDEO_ID
                        if (url.includes('youtube.com/watch')) {
                          const urlObj = new URL(url)
                          return urlObj.searchParams.get('v')
                        } 
                        // Handle youtu.be/VIDEO_ID
                        else if (url.includes('youtu.be/')) {
                          const urlObj = new URL(url)
                          return urlObj.pathname.slice(1).split('?')[0]
                        }
                        // Handle youtube.com/embed/VIDEO_ID
                        else if (url.includes('youtube.com/embed/')) {
                          return url.split('embed/')[1].split('?')[0]
                        }
                        // Try regex as last resort
                        const match = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
                        return match ? match[1] : null
                      } catch (e) {
                        console.error('Error parsing YouTube URL:', e)
                        return null
                      }
                    }

                    // Extract video ID ONLY for thumbnail purposes
                    const videoId = getYouTubeVideoId(video)
                    console.log('Backend Video URL:', video, 'Extracted ID for thumbnail:', videoId)
                    console.log(video)
                    // Generate thumbnail URL from video ID (using YouTube's free thumbnail API)
                    const thumbnailUrl = videoId 
                      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                      : null
                    
                    return (
                      <div key={index} className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200 hover:border-green-500 hover:shadow-2xl transition-all h-full">
                        <div className="relative w-full aspect-video bg-gray-200">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                console.log('Thumbnail failed for:', videoId)
                                if (videoId && e.target.src.includes('hqdefault')) {
                                  e.target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                                } else if (videoId && e.target.src.includes('mqdefault')) {
                                  e.target.src = `https://img.youtube.com/vi/${videoId}/default.jpg`
                                } else if (videoId && e.target.src.includes('default.jpg')) {
                                  e.target.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                                } else {
                                  e.target.style.display = 'none'
                                  e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-semibold">Thumbnail Unavailable</div>'
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-semibold">
                              No Video ID Found
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/10" />
                          <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-lg flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            YouTube
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-2xl">
                              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <p className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2 leading-snug mb-4 flex-1">{video.title}</p>
                          <a
                            href={video}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-green-600 text-sm sm:text-base font-semibold hover:text-green-700 transition-colors underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Clicking video URL:', video)
                            }}
                          >
                            <span className="flex items-center gap-2">
                              Watch Tutorial
                              <ExternalLink className="w-4 h-4" />
                            </span>
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Disposal Locations */}
            {result.maps.length > 0 && (
              <div className="w-full mx-auto max-w-7xl">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 flex items-center gap-3 text-gray-900">
                  <MapPin className="w-7 h-7 lg:w-8 lg:h-8 text-green-600" />
                  Disposal Locations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                  {result.maps.map((location, index) => (
                    <div key={index} className="transform transition-all duration-200 hover:scale-105 active:scale-95">
                      <a
                        href={location}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-5 bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-gray-200 hover:border-green-500 hover:shadow-2xl transition-all cursor-pointer"
                        style={{ textDecoration: 'none' }}
                      >
                        <div className="w-16 h-16 sm:w-18 sm:h-18 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-8 h-8 sm:w-9 sm:h-9 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-lg sm:text-xl text-gray-900 mb-2">{location.name}</p>
                          <p className="text-gray-700 text-sm sm:text-base line-clamp-2">{location}</p>
                        </div>
                        <ExternalLink className="w-6 h-6 text-green-600 flex-shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alternatives Modal */}
          {showAlternatives && (
            <>
              <div
                className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                onClick={() => setShowAlternatives(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 z-50 shadow-2xl max-h-[85vh] overflow-y-auto sm:max-w-xl sm:mx-auto sm:left-1/2 sm:-translate-x-1/2">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
                <h3 className="text-xl sm:text-2xl font-bold mb-5 text-gray-900">Select the correct product</h3>

                <div className="space-y-3 mb-6">
                  {result.other_predictions.map((pred, index) => (
                    <button
                      key={index}
                      onClick={() => handleAlternativeSelect(pred.object)}
                      className="w-full bg-green-50 text-gray-900 py-4 px-5 rounded-2xl font-semibold flex items-center justify-between hover:bg-green-100 transition-colors text-base border-2 border-green-200"
                    >
                      <span className="text-gray-900">{pred.object}</span>
                      <span className="text-gray-700 text-sm font-bold">{(pred.probability * 100).toFixed(0)}%</span>
                    </button>
                  ))}
                </div>

                <div className="border-t-2 border-gray-200 pt-5">
                  <p className="text-sm text-gray-700 mb-3 font-medium">Not in the list?</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Enter product name"
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-base text-gray-900 placeholder-gray-500"
                    />
                    <button
                      onClick={() => customInput && handleAlternativeSelect(customInput)}
                      disabled={!customInput}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-700 hover:to-emerald-700 transition-all whitespace-nowrap"
                    >
                      Get
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowAlternatives(false)}
                  className="w-full mt-4 bg-gray-200 text-gray-800 py-4 rounded-2xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}